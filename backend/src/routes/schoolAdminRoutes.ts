import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { normalizePhone } from '../services/phoneNormalizer.js';
import { dashboardCache } from '../services/dashboardCache.js';
import { classifyLeadStatus, parseDate } from '../services/sheetParser.js';

export const schoolAdminRouter = Router();

/**
 * GET /api/school-admin/users
 * Lists counselors belonging to the authenticated school tenant.
 */
schoolAdminRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.query.tenantId === 'string') {
      targetTenantId = req.query.tenantId;
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is required' });
      return;
    }

    const usersRes = await query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [targetTenantId]
    );

    res.json(usersRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch school users' });
  }
});

/**
 * POST /api/school-admin/users
 * Creates a new counselor account for the school tenant.
 */
schoolAdminRouter.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.body.tenantId === 'string') {
      targetTenantId = req.body.tenantId;
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is required' });
      return;
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUserRes = await query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'COUNSELOR', true)
       RETURNING id, name, email, role, is_active, created_at`,
      [targetTenantId, name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    res.status(201).json(newUserRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create counselor' });
  }
});

/**
 * PATCH /api/school-admin/users/:id
 * Toggles counselor activation status or resets password.
 */
schoolAdminRouter.patch('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.body.tenantId === 'string') {
      targetTenantId = req.body.tenantId;
    }

    const { id } = req.params;
    const { is_active, password } = req.body;

    // Verify counselor belongs to this tenant and is NOT a SUPER_ADMIN
    const targetUser = await query(
      `SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2`,
      [id, targetTenantId]
    );

    if (!targetUser.rows.length) {
      res.status(404).json({ error: 'User not found in this school tenant' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let valIdx = 1;

    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${valIdx++}`);
      values.push(is_active);
    }

    if (typeof password === 'string' && password.length >= 6) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${valIdx++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid update parameters provided' });
      return;
    }

    values.push(id, targetTenantId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${valIdx++} AND tenant_id = $${valIdx++} RETURNING id, name, email, role, is_active`;
    const updateRes = await query(sql, values);

    res.json({ success: true, user: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

/**
 * Simple CSV parser supporting quotes, commas, semicolons, and newlines.
 */
function parseCsv(csvText: string): { rows: Array<Record<string, string>>; detectedCampaign?: string } {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      if (currentLine.trim().length > 0) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  if (lines.length < 1) return { rows: [] };

  const splitRow = (row: string): string[] => {
    const items: string[] = [];
    let cur = '';
    let inQ = false;
    // Detect delimiter (, or ;)
    const delimiter = row.includes(';') && !row.includes(',') ? ';' : ',';
    for (let j = 0; j < row.length; j++) {
      const c = row[j];
      if (c === '"') {
        if (inQ && row[j + 1] === '"') {
          cur += '"';
          j++;
        } else {
          inQ = !inQ;
        }
      } else if (c === delimiter && !inQ) {
        items.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    items.push(cur.trim());
    return items;
  };

  // Detect which line is the actual header row
  const headerKeywords = ['name', 'phone', 'mobile', 'email', 'date', 'grade', 'student', 'parent', 'sr', 'srno', 'feedback', 'status', 'remarks', 'remark', 'followup', 'city', 'experience', 'candidate', 'interview', 'salary', 'resume', 'notice', 'point'];
  let headerIndex = 0;
  let maxKeywordMatches = 0;
  let detectedCampaign: string | undefined = undefined;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = splitRow(lines[i]).map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
    let matches = 0;
    for (const cell of cells) {
      if (headerKeywords.some((kw) => cell.includes(kw))) {
        matches++;
      }
    }
    if (matches > maxKeywordMatches) {
      maxKeywordMatches = matches;
      headerIndex = i;
    }
  }

  // If a title row exists prior to the header row (e.g., "Dhaharan - Aziziya Leads")
  if (headerIndex > 0) {
    const titleCells = splitRow(lines[0]).filter((c) => c && c.trim().length > 0);
    if (titleCells.length > 0) {
      detectedCampaign = titleCells[0].trim();
    }
  }

  const rawHeaders = splitRow(lines[headerIndex]);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows: Array<Record<string, string>> = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = splitRow(lines[i]);
    // Skip completely empty rows (e.g. trailing commas from Excel exports)
    const hasData = values.some((v) => v && v.trim().length > 0);
    if (!hasData) continue;

    const rowObj: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      if (headers[h]) {
        rowObj[headers[h]] = values[h] !== undefined ? values[h] : '';
      }
    }
    rows.push(rowObj);
  }

  return { rows, detectedCampaign };
}

/**
 * POST /api/school-admin/leads/import-csv
 * Bulk imports leads from CSV into the tenant's database with phone normalization and duplicate detection.
 */
schoolAdminRouter.post('/leads/import-csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.body.tenantId === 'string') {
      targetTenantId = req.body.tenantId;
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is required' });
      return;
    }

    let parsedRows: Array<any> = [];
    let detectedCampaign: string | undefined = undefined;

    if (typeof req.body.csvText === 'string') {
      const parsed = parseCsv(req.body.csvText);
      parsedRows = parsed.rows;
      detectedCampaign = parsed.detectedCampaign;
    } else if (Array.isArray(req.body.rows)) {
      parsedRows = req.body.rows;
    } else {
      res.status(400).json({ error: 'Expected csvText (string) or rows (array)' });
      return;
    }

    if (parsedRows.length === 0) {
      res.status(400).json({ error: 'No data rows found in CSV' });
      return;
    }

    // Default campaign name: user-supplied in body > detected title from CSV > fallback 'Admissions'
    const defaultCampaignName = (req.body.campaignName || detectedCampaign || 'Admissions').trim();

    // Cache existing campaigns for this tenant
    const campaignsRes = await query(`SELECT id, tab_name FROM campaigns WHERE tenant_id = $1`, [targetTenantId]);
    const campaignMap = new Map<string, string>();
    campaignsRes.rows.forEach((c) => campaignMap.set(c.tab_name.toLowerCase(), c.id));

    // Get existing normalized phones for duplicate check
    const existingPhonesRes = await query(
      `SELECT phone_normalized FROM leads WHERE tenant_id = $1 AND phone_normalized IS NOT NULL`,
      [targetTenantId]
    );
    const existingPhones = new Set<string>(existingPhonesRes.rows.map((r) => r.phone_normalized));

    let importedCount = 0;
    let duplicateCount = 0;

    for (const row of parsedRows) {
      // Find row fields flexibly
      const name = (
        row.name ||
        row.candidatename ||
        row.parentname ||
        row.studentname ||
        row.parent ||
        row.student ||
        row.candidate ||
        row.fullname ||
        row['parent name'] ||
        row['name'] ||
        ''
      ).trim();
      if (!name) continue;

      const rawPhone = (
        row.phone ||
        row.phonenumber ||
        row.mobile ||
        row.mobilenumber ||
        row.contact ||
        row.cell ||
        row.whatsapp ||
        row['phone'] ||
        ''
      ).trim();
      const phoneNorm = normalizePhone(rawPhone);
      const rawGrade = (
        row.grade ||
        row.experience ||
        row.class ||
        row.standard ||
        row.role ||
        row.service ||
        row['grade'] ||
        'General'
      ).trim();
      const grade = rawGrade
        .replace(/\uFFFD/g, '-')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/(\d+)\?+(\d+)/g, '$1-$2');
      const campaignName = (
        row.campaign ||
        row.campaigntab ||
        row.tab ||
        row['campaign'] ||
        defaultCampaignName
      ).trim();

      // Find or create campaign
      let campaignId = campaignMap.get(campaignName.toLowerCase());
      if (!campaignId) {
        const newCampRes = await query(
          `INSERT INTO campaigns (tenant_id, tab_name, display_order)
           VALUES ($1, $2, 0)
           ON CONFLICT (tenant_id, tab_name) DO UPDATE SET is_active = true
           RETURNING id`,
          [targetTenantId, campaignName]
        );
        campaignId = newCampRes.rows[0].id;
        campaignMap.set(campaignName.toLowerCase(), campaignId!);
      }

      // Check duplicate
      let isDuplicate = false;
      if (phoneNorm && existingPhones.has(phoneNorm)) {
        isDuplicate = true;
        duplicateCount++;
      } else if (phoneNorm) {
        existingPhones.add(phoneNorm);
      }

      // Parse lead date
      let leadDate: Date = new Date();
      const rawDate = row.date || row.leaddate || row.entrydate || row['date'] || '';
      if (rawDate) {
        const parsedD = parseDate(rawDate);
        if (parsedD && !isNaN(parsedD.getTime())) {
          leadDate = parsedD;
        } else {
          const directParsed = new Date(rawDate);
          if (!isNaN(directParsed.getTime())) {
            leadDate = directParsed;
          }
        }
      }

      // Parse feedback / status / remarks
      const rawFeedback = (
        row.remarks ||
        row.remark ||
        row.feedback ||
        row.status ||
        row.followupstatus ||
        row.interviewstatus ||
        row.notes ||
        row['feedback'] ||
        ''
      ).trim();

      const followups = [
        row.followup1 || row.followup_1 || row['followup 1'] || row['followup - 1'],
        row.followup2 || row.followup_2 || row['followup 2'] || row['followup - 2'] || row.interviewstatus,
        row.followup3 || row.followup_3 || row['followup 3'] || row['followup - 3'],
      ]
        .filter((f): f is string => typeof f === 'string' && f.trim().length > 0 && f.trim() !== '-' && f.trim() !== '--')
        .map((f) => f.trim());

      const classified = classifyLeadStatus(rawFeedback, followups, {});

      const insertLeadRes = await query(
        `INSERT INTO leads (
           tenant_id, campaign_id, parent_name, phone_raw, phone_normalized,
           grade, feedback_status, pending_substatus, is_duplicate, lead_date,
           status_updated_by_app
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
         RETURNING id`,
        [
          targetTenantId,
          campaignId,
          name,
          rawPhone || null,
          phoneNorm,
          grade,
          classified.feedbackStatus,
          classified.pendingSubstatus,
          isDuplicate,
          leadDate,
        ]
      );

      const leadId = insertLeadRes.rows[0].id;

      // Also record email / city metadata as initial lead notes if present
      const metadataNotes: string[] = [];
      if (row.email && row.email.trim()) metadataNotes.push(`Email: ${row.email.trim()}`);
      if (row.city && row.city.trim()) metadataNotes.push(`City: ${row.city.trim()}`);
      if (row.experience && row.experience.trim()) metadataNotes.push(`Experience: ${row.experience.trim()}`);
      if (row.currentemployment && row.currentemployment.trim()) metadataNotes.push(`Employment: ${row.currentemployment.trim()}`);
      if (row.noticeperiodjoiningavailability && row.noticeperiodjoiningavailability.trim()) metadataNotes.push(`Notice: ${row.noticeperiodjoiningavailability.trim()}`);
      if (row.currentlastdrawnsalary && row.currentlastdrawnsalary.trim()) metadataNotes.push(`Salary: ${row.currentlastdrawnsalary.trim()}`);
      if (row.resumereceived && row.resumereceived.trim()) metadataNotes.push(`Resume: ${row.resumereceived.trim()}`);
      if (row.points10 && row.points10.trim()) metadataNotes.push(`Points: ${row.points10.trim()}/10`);
      if (metadataNotes.length > 0) {
        await query(
          `INSERT INTO follow_up_notes (tenant_id, lead_id, stage, note_text, counselor_tag, source, noted_at)
           VALUES ($1, $2, 0, $3, 'CSV Metadata', 'WEB_APP', NOW())`,
          [targetTenantId, leadId, metadataNotes.join(' | ')]
        );
      }

      // Insert follow-up notes from row into database
      for (let s = 0; s < followups.length; s++) {
        const noteText = followups[s];
        if (noteText && typeof noteText === 'string' && noteText.trim().length > 0) {
          await query(
            `INSERT INTO follow_up_notes (tenant_id, lead_id, stage, note_text, counselor_tag, source, noted_at)
             VALUES ($1, $2, $3, $4, 'CSV Import', 'WEB_APP', NOW())`,
            [targetTenantId, leadId, s + 1, noteText.trim()]
          );
        }
      }

      importedCount++;
    }

    // Invalidate KPI LRU cache
    dashboardCache.invalidate(targetTenantId);

    res.json({
      success: true,
      totalProcessed: parsedRows.length,
      importedCount,
      duplicateCount,
    });
  } catch (err: any) {
    console.error('[SchoolAdmin] CSV import failed:', err);
    res.status(500).json({ error: err.message || 'Failed to import CSV' });
  }
});


/**
 * GET /api/school-admin/leads/export-csv
 * Exports tenant leads as RFC 4180 CSV.
 */
schoolAdminRouter.get('/leads/export-csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.query.tenantId === 'string') {
      targetTenantId = req.query.tenantId;
    }

    if (!targetTenantId) {
      res.status(400).json({ error: 'Tenant context is required' });
      return;
    }

    const { campaignId, status } = req.query;
    const conditions: string[] = ['l.tenant_id = $1'];
    const values: any[] = [targetTenantId];
    let valIdx = 2;

    if (campaignId && typeof campaignId === 'string' && campaignId.toUpperCase() !== 'ALL') {
      conditions.push(`l.campaign_id = $${valIdx++}`);
      values.push(campaignId);
    }

    if (status && typeof status === 'string' && status.toUpperCase() !== 'ALL') {
      conditions.push(`l.feedback_status = $${valIdx++}`);
      values.push(status.toUpperCase());
    }

    const leadsRes = await query(
      `SELECT 
        l.id,
        c.tab_name as campaign,
        l.parent_name,
        l.phone_raw,
        l.phone_normalized,
        l.grade,
        l.feedback_status,
        l.pending_substatus,
        l.is_duplicate,
        l.lead_date,
        l.first_contact_at,
        l.last_updated_at,
        (
          SELECT string_agg(fn.note_text, ' | ' ORDER BY fn.noted_at ASC)
          FROM follow_up_notes fn
          WHERE fn.lead_id = l.id
        ) as all_notes
       FROM leads l
       JOIN campaigns c ON l.campaign_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.lead_date DESC, l.created_at DESC`,
      values
    );

    // Escape CSV cell value
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Lead ID',
      'Campaign',
      'Parent Name',
      'Raw Phone',
      'Normalized Phone',
      'Grade',
      'Feedback Status',
      'Pending Sub-Status',
      'Duplicate',
      'Lead Date',
      'First Contact At',
      'Last Updated At',
      'Follow-Up Notes',
    ];

    const csvLines = [headers.map(escapeCsv).join(',')];

    for (const lead of leadsRes.rows) {
      const row = [
        lead.id,
        lead.campaign,
        lead.parent_name,
        lead.phone_raw || '',
        lead.phone_normalized || '',
        lead.grade || '',
        lead.feedback_status || '',
        lead.pending_substatus || '',
        lead.is_duplicate ? 'Yes' : 'No',
        lead.lead_date ? new Date(lead.lead_date).toISOString().slice(0, 10) : '',
        lead.first_contact_at ? new Date(lead.first_contact_at).toISOString() : '',
        lead.last_updated_at ? new Date(lead.last_updated_at).toISOString() : '',
        lead.all_notes || '',
      ];
      csvLines.push(row.map(escapeCsv).join(','));
    }

    const csvContent = csvLines.join('\r\n');
    const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    console.error('[SchoolAdmin] Export CSV failed:', err);
    res.status(500).json({ error: err.message || 'Failed to export CSV' });
  }
});
