import crypto from 'crypto';
import { query } from '../db/index.js';
import { ISheetReader, defaultSheetsService } from './googleSheetsService.js';
import { normalizePhone } from './phoneNormalizer.js';
import { parseDate, parseFollowUpCell, classifyLeadStatus } from './sheetParser.js';
import { invalidateTenantDashboardCache } from './dashboardCache.js';

// In-memory active sync lock to guarantee single-flight execution per tenant
const activeSyncs = new Set<string>();

export interface SyncResult {
  success: boolean;
  tenantId: string;
  campaignsCount: number;
  leadsProcessed: number;
  lastSyncedAt: Date;
  message: string;
}

/**
 * Executes a full synchronization cycle for a single tenant from its connected Google Sheet.
 * Accepts an optional sheetReader for dependency injection and testing.
 */
export async function syncTenant(
  tenantId: string,
  sheetReader: ISheetReader = defaultSheetsService
): Promise<SyncResult> {
  if (activeSyncs.has(tenantId)) {
    throw new Error('Sync already in progress for this tenant');
  }

  activeSyncs.add(tenantId);

  try {
    // 1. Fetch tenant metadata
    const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenantRes.rows.length === 0) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    const tenant = tenantRes.rows[0];

    if (tenant.status !== 'ACTIVE') {
      throw new Error(`Cannot sync inactive or suspended tenant (${tenant.status})`);
    }

    if (tenant.data_mode !== 'HYBRID_SHEET') {
      throw new Error(`Tenant data mode is ${tenant.data_mode}; Google Sheet sync is disabled`);
    }

    if (!tenant.google_sheet_id) {
      throw new Error('Google Sheet ID is not configured for this tenant');
    }

    // 2. Discover spreadsheet tabs dynamically
    const tabNames = await sheetReader.getSpreadsheetTabs(tenant.google_sheet_id);
    if (!tabNames || tabNames.length === 0) {
      throw new Error('Spreadsheet has no valid sheets/tabs to import');
    }

    let totalLeadsProcessed = 0;

    for (let tabIndex = 0; tabIndex < tabNames.length; tabIndex++) {
      const tabName = tabNames[tabIndex];

      // Upsert Campaign in database
      const campaignRes = await query(
        `INSERT INTO campaigns (tenant_id, tab_name, display_order, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (tenant_id, tab_name)
         DO UPDATE SET is_active = true, display_order = EXCLUDED.display_order
         RETURNING id`,
        [tenantId, tabName, tabIndex]
      );
      const campaignId = campaignRes.rows[0].id;

      // 3. Read tab rows
      const rows = await sheetReader.getSheetData(tenant.google_sheet_id, tabName);
      if (!rows || rows.length < 2) {
        continue; // Empty tab or header only
      }

      // Map headers case-insensitively
      const headers = rows[0].map((h) => h.toLowerCase().trim());
      const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('تاريخ'));
      const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('student') || h.includes('parent') || h.includes('candidate') || h.includes('اسم'));
      const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('هاتف') || h.includes('جوال'));
      const gradeIdx = headers.findIndex((h) => h.includes('grade') || h.includes('class') || h.includes('experience') || h.includes('role') || h.includes('service') || h.includes('صف'));
      const feedbackIdx = headers.findIndex((h) => h.includes('feedback') || h.includes('status') || h.includes('remarks') || h.includes('remark') || h.includes('حالة'));
      const followup1Idx = headers.findIndex((h) => /followup\s*-?\s*1|متابعة\s*1/.test(h));
      const followup2Idx = headers.findIndex((h) => /followup\s*-?\s*2|interview|متابعة\s*2/.test(h));
      const followup3Idx = headers.findIndex((h) => /followup\s*-?\s*3|متابعة\s*3/.test(h));

      // 4. Process each row
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
        const rawName = nameIdx >= 0 ? row[nameIdx] : '';
        const rawPhone = phoneIdx >= 0 ? row[phoneIdx] : '';
        const rawGrade = gradeIdx >= 0 ? row[gradeIdx] : '';
        const rawFeedback = feedbackIdx >= 0 ? row[feedbackIdx] : '';
        const rawF1 = followup1Idx >= 0 ? row[followup1Idx] : '';
        const rawF2 = followup2Idx >= 0 ? row[followup2Idx] : '';
        const rawF3 = followup3Idx >= 0 ? row[followup3Idx] : '';

        // If row is entirely blank, skip
        if (!rawName && !rawPhone && !rawF1 && !rawF2 && !rawF3) {
          continue;
        }

        const phoneNormalized = normalizePhone(rawPhone);
        const sheetRowNumber = r + 1; // 1-indexed spreadsheet row
        const rowFingerprint = crypto
          .createHash('sha256')
          .update(`${tenantId}:${tabName}:${sheetRowNumber}`)
          .digest('hex');

        // Parse individual notes from Followup 1/2/3
        const notes = [
          ...parseFollowUpCell(rawF1, 1),
          ...parseFollowUpCell(rawF2, 2),
          ...parseFollowUpCell(rawF3, 3),
        ];

        // Status classification
        const { feedbackStatus, pendingSubstatus } = classifyLeadStatus(
          rawFeedback,
          notes.map((n) => n.noteText),
          tenant.keyword_rules
        );

        // Date parsing
        const leadDate = rawDate ? parseDate(rawDate) : null;
        let firstContactAt: Date | null = null;
        if (notes.length > 0) {
          // Earliest note date
          const sorted = [...notes].sort((a, b) => a.notedAt.getTime() - b.notedAt.getTime());
          firstContactAt = sorted[0].notedAt;
        }

        // Duplicate Lead Detection
        let isDuplicate = false;
        if (phoneNormalized) {
          const dupCheck = await query(
            `SELECT id FROM leads
             WHERE tenant_id = $1 AND phone_normalized = $2 AND external_row_hash <> $3
             LIMIT 1`,
            [tenantId, phoneNormalized, rowFingerprint]
          );
          if (dupCheck.rows.length > 0) {
            isDuplicate = true;
          }
        }

        // Check if lead already exists in DB
        const existingRes = await query(
          'SELECT id, status_updated_by_app FROM leads WHERE tenant_id = $1 AND external_row_hash = $2',
          [tenantId, rowFingerprint]
        );

        let leadId: string;

        if (existingRes.rows.length > 0) {
          const existing = existingRes.rows[0];
          leadId = existing.id;

          // Conflict resolution rule:
          // If status was updated by web app, DO NOT overwrite feedback_status/pending_substatus from sheet
          if (existing.status_updated_by_app) {
            await query(
              `UPDATE leads
               SET parent_name = $1, phone_raw = $2, phone_normalized = $3, grade = $4,
                   lead_date = COALESCE($5, lead_date), is_duplicate = $6, sheet_row_number = $7,
                   last_updated_at = NOW()
               WHERE id = $8`,
              [
                rawName || 'Parent',
                rawPhone || null,
                phoneNormalized,
                rawGrade || null,
                leadDate,
                isDuplicate,
                sheetRowNumber,
                leadId,
              ]
            );
          } else {
            await query(
              `UPDATE leads
               SET parent_name = $1, phone_raw = $2, phone_normalized = $3, grade = $4,
                   feedback_status = $5, pending_substatus = $6, lead_date = COALESCE($7, lead_date),
                   first_contact_at = COALESCE(first_contact_at, $8), is_duplicate = $9,
                   sheet_row_number = $10, last_updated_at = NOW()
               WHERE id = $11`,
              [
                rawName || 'Parent',
                rawPhone || null,
                phoneNormalized,
                rawGrade || null,
                feedbackStatus,
                pendingSubstatus,
                leadDate,
                firstContactAt,
                isDuplicate,
                sheetRowNumber,
                leadId,
              ]
            );
          }
        } else {
          // Insert new lead
          const insertRes = await query(
            `INSERT INTO leads (
               tenant_id, campaign_id, external_row_hash, sheet_row_number,
               parent_name, phone_raw, phone_normalized, grade,
               feedback_status, pending_substatus, is_duplicate,
               lead_date, first_contact_at, last_updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
             RETURNING id`,
            [
              tenantId,
              campaignId,
              rowFingerprint,
              sheetRowNumber,
              rawName || 'Parent',
              rawPhone || null,
              phoneNormalized,
              rawGrade || null,
              feedbackStatus,
              pendingSubstatus,
              isDuplicate,
              leadDate,
              firstContactAt,
            ]
          );
          leadId = insertRes.rows[0].id;
        }

        // Insert notes (avoid duplicate note inserts for the same lead and text)
        for (const note of notes) {
          const noteCheck = await query(
            `SELECT id FROM follow_up_notes
             WHERE lead_id = $1 AND stage = $2 AND note_text = $3
             LIMIT 1`,
            [leadId, note.stage, note.noteText]
          );

          if (noteCheck.rows.length === 0) {
            await query(
              `INSERT INTO follow_up_notes (
                 tenant_id, lead_id, stage, note_text, counselor_tag, source, noted_at
               ) VALUES ($1, $2, $3, $4, $5, 'GOOGLE_SHEET', $6)`,
              [tenantId, leadId, note.stage, note.noteText, note.counselorTag || null, note.notedAt]
            );
          }
        }

        totalLeadsProcessed++;
      }
    }

    // 5. Update tenant sync state on success
    const now = new Date();
    await query(
      `UPDATE tenants
       SET last_synced_at = $1, last_sync_error = NULL
       WHERE id = $2`,
      [now, tenantId]
    );

    // 6. Invalidate dashboard cache
    invalidateTenantDashboardCache(tenantId);

    return {
      success: true,
      tenantId,
      campaignsCount: tabNames.length,
      leadsProcessed: totalLeadsProcessed,
      lastSyncedAt: now,
      message: `Successfully synchronized ${totalLeadsProcessed} leads across ${tabNames.length} campaigns.`,
    };
  } catch (err: any) {
    // Record error in database
    await query(
      `UPDATE tenants
       SET last_sync_error = $1
       WHERE id = $2`,
      [err.message || 'Unknown sync error', tenantId]
    ).catch(() => {});

    throw err;
  } finally {
    activeSyncs.delete(tenantId);
  }
}

/**
 * Synchronizes all active tenants configured for HYBRID_SHEET sync.
 */
export async function syncAllActiveTenants(
  sheetReader: ISheetReader = defaultSheetsService
): Promise<{ syncedCount: number; errors: { tenantId: string; error: string }[] }> {
  const tenantsRes = await query(
    `SELECT id, name FROM tenants
     WHERE status = 'ACTIVE' AND data_mode = 'HYBRID_SHEET' AND google_sheet_id IS NOT NULL`
  );

  let syncedCount = 0;
  const errors: { tenantId: string; error: string }[] = [];

  for (const t of tenantsRes.rows) {
    try {
      await syncTenant(t.id, sheetReader);
      syncedCount++;
    } catch (err: any) {
      errors.push({ tenantId: t.id, error: err.message });
    }
  }

  return { syncedCount, errors };
}

