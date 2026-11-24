import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { dashboardCache } from '../services/dashboardCache.js';
import { writeBackNoteToSheet } from '../services/writebackService.js';

export const leadRouter = Router();

const VALID_FEEDBACK_STATUSES = ['POSITIVE', 'PENDING', 'NEGATIVE', 'NOT_CONTACTED', 'INVALID_DUPLICATE'];
const VALID_PENDING_SUBSTATUSES = ['MSG_NO_REPLY', 'CALLED_NO_ANSWER', 'ANSWERED_NO_DECISION', 'OTHER'];
const VALID_SORT_COLUMNS: Record<string, string> = {
  lead_date: 'l.lead_date',
  last_updated_at: 'l.last_updated_at',
  parent_name: 'l.parent_name',
  grade: 'l.grade',
  feedback_status: 'l.feedback_status',
  first_contact_at: 'l.first_contact_at',
};

/**
 * GET /api/leads
 * Master Lead List with pagination, filters, sorting, and search.
 */
leadRouter.get('/', async (req: Request, res: Response): Promise<void> => {
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

    const {
      campaignId,
      status,
      pendingSubstatus,
      grade,
      coldOnly,
      search,
      sortBy = 'lead_date',
      order = 'desc',
      page = '1',
      limit = '25',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['l.tenant_id = $1'];
    const values: any[] = [targetTenantId];
    let valIdx = 2;

    // Filter by Campaign
    if (campaignId && typeof campaignId === 'string' && campaignId.toUpperCase() !== 'ALL') {
      conditions.push(`l.campaign_id = $${valIdx}`);
      values.push(campaignId);
      valIdx++;
    }

    // Filter by Status
    if (status && typeof status === 'string') {
      const upperStatus = status.toUpperCase();
      if (upperStatus === 'OPEN') {
        conditions.push(`l.feedback_status NOT IN ('NEGATIVE', 'INVALID_DUPLICATE')`);
      } else if (VALID_FEEDBACK_STATUSES.includes(upperStatus)) {
        conditions.push(`l.feedback_status = $${valIdx}`);
        values.push(upperStatus);
        valIdx++;
      }
    }

    // Filter by Pending Sub-status
    if (pendingSubstatus && typeof pendingSubstatus === 'string') {
      const upperSub = pendingSubstatus.toUpperCase();
      if (VALID_PENDING_SUBSTATUSES.includes(upperSub)) {
        conditions.push(`l.pending_substatus = $${valIdx}`);
        values.push(upperSub);
        valIdx++;
      }
    }

    // Filter by Grade
    if (grade && typeof grade === 'string' && grade.toUpperCase() !== 'ALL') {
      conditions.push(`l.grade = $${valIdx}`);
      values.push(grade);
      valIdx++;
    }

    // Filter by Cold Leads (No contact in 3+ days or no update in 3+ days)
    if (coldOnly === 'true' || coldOnly === '1') {
      conditions.push(
        `((l.first_contact_at IS NULL AND l.lead_date <= NOW() - INTERVAL '3 days') OR (l.last_updated_at <= NOW() - INTERVAL '3 days'))`
      );
    }

    // Free-text Search across parent_name, phone_raw, phone_normalized, and notes
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(`(
        l.parent_name ILIKE $${valIdx} OR
        l.phone_raw ILIKE $${valIdx} OR
        l.phone_normalized ILIKE $${valIdx} OR
        EXISTS (
          SELECT 1 FROM follow_up_notes fn
          WHERE fn.lead_id = l.id AND fn.note_text ILIKE $${valIdx}
        )
      )`);
      values.push(searchPattern);
      valIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Sort order
    const sortCol = VALID_SORT_COLUMNS[sortBy as string] || 'l.lead_date';
    const sortDir = (order as string).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Total count query
    const countSql = `SELECT COUNT(*)::int as total FROM leads l WHERE ${whereClause}`;
    const countRes = await query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    // Leads query with latest note subquery
    const leadsSql = `
      SELECT 
        l.id,
        l.tenant_id,
        l.campaign_id,
        c.tab_name as campaign_tab,
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
        l.status_updated_by_app,
        (
          SELECT COUNT(*)::int 
          FROM follow_up_notes fn 
          WHERE fn.lead_id = l.id
        ) as notes_count,
        (
          SELECT json_build_object(
            'id', fn.id,
            'stage', fn.stage,
            'note_text', fn.note_text,
            'counselor_tag', fn.counselor_tag,
            'source', fn.source,
            'noted_at', fn.noted_at
          )
          FROM follow_up_notes fn
          WHERE fn.lead_id = l.id
          ORDER BY fn.noted_at DESC, fn.stage DESC
          LIMIT 1
        ) as latest_note
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortDir}, l.created_at DESC
      LIMIT $${valIdx} OFFSET $${valIdx + 1}
    `;

    const leadsRes = await query(leadsSql, [...values, limitNum, offset]);

    res.json({
      leads: leadsRes.rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
    });
  } catch (err: any) {
    console.error('[LeadRoutes] Error listing leads:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch leads' });
  }
});

/**
 * GET /api/leads/:id
 * Fetches single lead details with all chronological follow-up notes.
 */
leadRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.query.tenantId === 'string') {
      targetTenantId = req.query.tenantId;
    }

    const { id } = req.params;

    const leadRes = await query(
      `SELECT 
        l.id,
        l.tenant_id,
        l.campaign_id,
        c.tab_name as campaign_tab,
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
        l.status_updated_by_app,
        l.created_at
       FROM leads l
       JOIN campaigns c ON l.campaign_id = c.id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [id, targetTenantId]
    );

    if (!leadRes.rows.length) {
      res.status(404).json({ error: 'Lead not found or access denied' });
      return;
    }

    const notesRes = await query(
      `SELECT 
        id,
        stage,
        note_text,
        counselor_tag,
        source,
        noted_at
       FROM follow_up_notes
       WHERE lead_id = $1 AND tenant_id = $2
       ORDER BY noted_at ASC, stage ASC`,
      [id, targetTenantId]
    );

    res.json({
      lead: leadRes.rows[0],
      notes: notesRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch lead details' });
  }
});

/**
 * POST /api/leads/:id/notes
 * Adds a new follow-up note, updates status & first_contact_at, purges LRU cache,
 * and triggers optional Google Sheets two-way write-back.
 */
leadRouter.post('/:id/notes', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.body.tenantId === 'string') {
      targetTenantId = req.body.tenantId;
    }

    const { id } = req.params;
    const { stage, noteText, feedbackStatus, pendingSubstatus } = req.body;

    if (!stage || typeof stage !== 'number' || stage < 1) {
      res.status(400).json({ error: 'Stage number is required and must be >= 1' });
      return;
    }

    if (!noteText || typeof noteText !== 'string' || noteText.trim().length === 0) {
      res.status(400).json({ error: 'Note text cannot be empty' });
      return;
    }

    if (feedbackStatus && !VALID_FEEDBACK_STATUSES.includes(feedbackStatus.toUpperCase())) {
      res.status(400).json({ error: `Invalid feedbackStatus. Allowed: ${VALID_FEEDBACK_STATUSES.join(', ')}` });
      return;
    }

    if (pendingSubstatus && !VALID_PENDING_SUBSTATUSES.includes(pendingSubstatus.toUpperCase())) {
      res.status(400).json({ error: `Invalid pendingSubstatus. Allowed: ${VALID_PENDING_SUBSTATUSES.join(', ')}` });
      return;
    }

    // Verify lead exists and belongs to tenant
    const leadCheck = await query(
      `SELECT id, first_contact_at, feedback_status, pending_substatus FROM leads WHERE id = $1 AND tenant_id = $2`,
      [id, targetTenantId]
    );

    if (!leadCheck.rows.length) {
      res.status(404).json({ error: 'Lead not found or access denied' });
      return;
    }

    const existingLead = leadCheck.rows[0];

    // Determine status updates
    const newStatus = feedbackStatus ? feedbackStatus.toUpperCase() : existingLead.feedback_status;
    let newSubstatus = existingLead.pending_substatus;

    if (newStatus === 'PENDING') {
      newSubstatus = pendingSubstatus ? pendingSubstatus.toUpperCase() : (existingLead.pending_substatus || 'OTHER');
    } else {
      newSubstatus = null;
    }

    // Insert follow_up_note
    const noteRes = await query(
      `INSERT INTO follow_up_notes (tenant_id, lead_id, user_id, stage, note_text, counselor_tag, source, noted_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'WEB_APP', NOW())
       RETURNING id, stage, note_text, counselor_tag, source, noted_at`,
      [targetTenantId, id, user.userId, stage, noteText.trim(), user.name]
    );

    // Update lead record
    const updatedLeadRes = await query(
      `UPDATE leads
       SET 
         feedback_status = $1,
         pending_substatus = $2,
         first_contact_at = COALESCE(first_contact_at, NOW()),
         last_updated_at = NOW(),
         status_updated_by_app = true
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [newStatus, newSubstatus, id, targetTenantId]
    );

    // Invalidate in-memory KPI LRU cache
    dashboardCache.invalidate(targetTenantId!);

    // Trigger optional sheet write-back in the background
    writeBackNoteToSheet({
      tenantId: targetTenantId!,
      leadId: id,
      stage,
      noteText: noteText.trim(),
      counselorName: user.name,
    }).catch((err) => console.warn('[LeadRoutes] Writeback background error:', err));

    res.status(201).json({
      success: true,
      note: noteRes.rows[0],
      lead: updatedLeadRes.rows[0],
    });
  } catch (err: any) {
    console.error('[LeadRoutes] Error adding note:', err);
    res.status(500).json({ error: err.message || 'Failed to add note' });
  }
});

/**
 * PATCH /api/leads/:id/status
 * Updates feedback_status and pending_substatus directly.
 */
leadRouter.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let targetTenantId = user.tenantId;
    if (user.role === 'SUPER_ADMIN' && typeof req.body.tenantId === 'string') {
      targetTenantId = req.body.tenantId;
    }

    const { id } = req.params;
    const { feedbackStatus, pendingSubstatus } = req.body;

    if (!feedbackStatus || !VALID_FEEDBACK_STATUSES.includes(feedbackStatus.toUpperCase())) {
      res.status(400).json({ error: `Valid feedbackStatus is required (${VALID_FEEDBACK_STATUSES.join(', ')})` });
      return;
    }

    const newStatus = feedbackStatus.toUpperCase();
    let newSubstatus: string | null = null;
    if (newStatus === 'PENDING') {
      newSubstatus = pendingSubstatus ? pendingSubstatus.toUpperCase() : 'OTHER';
    }

    const updateRes = await query(
      `UPDATE leads
       SET 
         feedback_status = $1,
         pending_substatus = $2,
         first_contact_at = COALESCE(first_contact_at, CASE WHEN $1 <> 'NOT_CONTACTED' THEN NOW() ELSE NULL END),
         last_updated_at = NOW(),
         status_updated_by_app = true
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [newStatus, newSubstatus, id, targetTenantId]
    );

    if (!updateRes.rows.length) {
      res.status(404).json({ error: 'Lead not found or access denied' });
      return;
    }

    // Invalidate KPI LRU cache
    dashboardCache.invalidate(targetTenantId!);

    res.json({
      success: true,
      lead: updateRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update lead status' });
  }
});
