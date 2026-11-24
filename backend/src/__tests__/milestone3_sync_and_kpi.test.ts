import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import * as db from '../db/index.js';
import { normalizePhone, buildWhatsAppLink } from '../services/phoneNormalizer.js';
import { parseDate, parseFollowUpCell, classifyLeadStatus } from '../services/sheetParser.js';
import { syncTenant } from '../services/syncEngine.js';
import { ISheetReader } from '../services/googleSheetsService.js';
import {
  getDashboardCache,
  setDashboardCache,
  invalidateTenantDashboardCache,
  clearAllDashboardCache,
} from '../services/dashboardCache.js';
import { getDashboardOverview } from '../services/kpiService.js';

vi.mock('../db/index.js', () => ({
  pool: {
    query: vi.fn(),
    on: vi.fn(),
  },
  query: vi.fn(),
  withTransaction: vi.fn(),
  checkDbConnection: vi.fn().mockResolvedValue(true),
}));

describe('Milestone 3 — Hybrid Sync Engine & KPI Aggregation', () => {
  const app = createApp();
  const testTenantId = 'tenant-m3-uuid';

  const adminToken = jwt.sign(
    {
      userId: 'user-admin-1',
      email: 'admin@yen.edu',
      role: 'SCHOOL_ADMIN',
      tenantId: testTenantId,
      name: 'Yen School Admin',
    },
    config.jwt.secret
  );

  const counselorToken = jwt.sign(
    {
      userId: 'user-counselor-1',
      email: 'counselor@yen.edu',
      role: 'COUNSELOR',
      tenantId: testTenantId,
      name: 'Yen Counselor',
    },
    config.jwt.secret
  );

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllDashboardCache();
  });

  describe('1. Phone Normalizer & WhatsApp Link Generator', () => {
    it('normalizes local Saudi numbers (05xxxxxxxx and 5xxxxxxxx) to 9665xxxxxxxx', () => {
      expect(normalizePhone('0501234567')).toBe('966501234567');
      expect(normalizePhone('501234567')).toBe('966501234567');
      expect(normalizePhone('+966501234567')).toBe('966501234567');
      expect(normalizePhone('00966501234567')).toBe('966501234567');
    });

    it('strips spaces, dashes, parentheses, and prefixes like "p:"', () => {
      expect(normalizePhone('p: 050-123 4567')).toBe('966501234567');
      expect(normalizePhone('tel: (050) 123-4567')).toBe('966501234567');
      expect(normalizePhone('+1 (555) 234-5678')).toBe('15552345678');
    });

    it('returns null for empty, invalid, or too-short inputs', () => {
      expect(normalizePhone('')).toBeNull();
      expect(normalizePhone(null)).toBeNull();
      expect(normalizePhone('12345')).toBeNull();
    });

    it('generates valid WhatsApp chat URLs', () => {
      expect(buildWhatsAppLink('966501234567')).toBe('https://wa.me/966501234567');
      expect(buildWhatsAppLink('966501234567', 'Hello!')).toBe(
        'https://wa.me/966501234567?text=Hello!'
      );
      expect(buildWhatsAppLink(null)).toBeNull();
    });
  });

  describe('2. Sheet Regex Note & Date Parser', () => {
    it('parses dates across DD.MM.YYYY, DD/MM/YYYY, and YYYY-MM-DD formats', () => {
      const d1 = parseDate('16.11.2026');
      expect(d1).not.toBeNull();
      expect(d1?.getDate()).toBe(16);
      expect(d1?.getMonth()).toBe(10); // 0-indexed November = 10
      expect(d1?.getFullYear()).toBe(2026);

      const d2 = parseDate('2026-11-20');
      expect(d2?.getFullYear()).toBe(2026);
    });

    it('parses free-text cells with pipe-separated notes, dates, and counselor tags', () => {
      const cell =
        '16.11.2026 | sent a reminder (sara) | 17.11.2026 | answered | interested in admission (john)';
      const notes = parseFollowUpCell(cell, 1);

      expect(notes.length).toBe(2);
      expect(notes[0].counselorTag).toBe('sara');
      expect(notes[0].noteText).toContain('sent a reminder');
      expect(notes[0].stage).toBe(1);

      expect(notes[1].counselorTag).toBe('john');
      expect(notes[1].noteText).toContain('interested in admission');
    });

    it('classifies feedback status based on keyword rules', () => {
      // Positive
      const pos = classifyLeadStatus('Interested in KG', ['16.11.2026 | will visit tomorrow']);
      expect(pos.feedbackStatus).toBe('POSITIVE');

      // Negative (e.g. not interested, dead lead)
      const neg = classifyLeadStatus('Not interested', ['father declined admission']);
      expect(neg.feedbackStatus).toBe('NEGATIVE');

      // Invalid / Duplicate
      const dup = classifyLeadStatus('Duplicate', []);
      expect(dup.feedbackStatus).toBe('INVALID_DUPLICATE');

      // Not Contacted
      const nc = classifyLeadStatus('', []);
      expect(nc.feedbackStatus).toBe('NOT_CONTACTED');

      // Pending with sub-status classification
      const pendingNoAnswer = classifyLeadStatus('Pending', ['no answer (counselor)']);
      expect(pendingNoAnswer.feedbackStatus).toBe('PENDING');
      expect(pendingNoAnswer.pendingSubstatus).toBe('CALLED_NO_ANSWER');

      const pendingMsg = classifyLeadStatus('', ['sent a reminder via whatsapp']);
      expect(pendingMsg.feedbackStatus).toBe('PENDING');
      expect(pendingMsg.pendingSubstatus).toBe('MSG_NO_REPLY');

      const pendingDecision = classifyLeadStatus('', ['answered | planning for next year']);
      expect(pendingDecision.feedbackStatus).toBe('PENDING');
      expect(pendingDecision.pendingSubstatus).toBe('ANSWERED_NO_DECISION');
    });
  });

  describe('3. Hybrid Sync Engine & Dynamic Campaign Discovery', () => {
    it('discovers dynamic tabs, upserts campaigns, and populates leads & notes', async () => {
      // 1. Mock tenant lookup
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: testTenantId,
              name: 'Yen School',
              status: 'ACTIVE',
              data_mode: 'HYBRID_SHEET',
              google_sheet_id: 'sample-sheet-id',
              keyword_rules: {},
            },
          ],
        } as any)
        // 2. Campaign upsert for Tab 1
        .mockResolvedValueOnce({ rows: [{ id: 'camp-1' }] } as any)
        // 3. Duplicate check for row 1
        .mockResolvedValueOnce({ rows: [] } as any)
        // 4. Existing lead check for row 1
        .mockResolvedValueOnce({ rows: [] } as any)
        // 5. Insert new lead row 1
        .mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] } as any)
        // 6. Note exists check
        .mockResolvedValueOnce({ rows: [] } as any)
        // 7. Insert note
        .mockResolvedValueOnce({ rows: [{ id: 'note-1' }] } as any)
        // 8. Update tenant last_synced_at
        .mockResolvedValueOnce({ rows: [] } as any);

      const mockReader: ISheetReader = {
        async getSpreadsheetTabs() {
          return ['Facebook Ads 2026'];
        },
        async getSheetData() {
          return [
            ['Date', 'Name', 'Phone', 'Grade', 'Feedback', 'Followup - 1', 'Followup - 2', 'Followup - 3'],
            ['10.11.2026', 'Ahmed Ali', '0501112233', 'Grade 1', 'Interested', '11.11.2026 | answered (sara)', '', ''],
          ];
        },
      };

      const syncResult = await syncTenant(testTenantId, mockReader);

      expect(syncResult.success).toBe(true);
      expect(syncResult.campaignsCount).toBe(1);
      expect(syncResult.leadsProcessed).toBe(1);
    });

    it('respects status_updated_by_app: does not overwrite web app edits on subsequent syncs', async () => {
      vi.mocked(db.query)
        // 1. Tenant lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: testTenantId,
              name: 'Yen School',
              status: 'ACTIVE',
              data_mode: 'HYBRID_SHEET',
              google_sheet_id: 'sample-sheet-id',
            },
          ],
        } as any)
        // 2. Campaign upsert
        .mockResolvedValueOnce({ rows: [{ id: 'camp-1' }] } as any)
        // 3. Duplicate check
        .mockResolvedValueOnce({ rows: [] } as any)
        // 4. Existing lead lookup -> status_updated_by_app is TRUE
        .mockResolvedValueOnce({
          rows: [{ id: 'lead-existing', status_updated_by_app: true }],
        } as any)
        // 5. Update lead (does NOT touch feedback_status)
        .mockResolvedValueOnce({ rows: [] } as any)
        // 6. Note check
        .mockResolvedValueOnce({ rows: [] } as any)
        // 7. Note insert
        .mockResolvedValueOnce({ rows: [{ id: 'note-2' }] } as any)
        // 8. Update tenant sync timestamp
        .mockResolvedValueOnce({ rows: [] } as any);

      const mockReader: ISheetReader = {
        async getSpreadsheetTabs() {
          return ['Facebook Ads 2026'];
        },
        async getSheetData() {
          return [
            ['Date', 'Name', 'Phone', 'Grade', 'Feedback', 'Followup - 1', 'Followup - 2', 'Followup - 3'],
            ['12.11.2026', 'Khalid Omar', '0502223344', 'Grade 3', 'Dead', '18.11.2026 | new note', '', ''],
          ];
        },
      };

      const res = await syncTenant(testTenantId, mockReader);
      expect(res.success).toBe(true);
      expect(res.leadsProcessed).toBe(1);
    });
  });

  describe('4. In-Memory LRU Cache', () => {
    it('sets, retrieves, and invalidates dashboard cache entries for a tenant', () => {
      setDashboardCache(testTenantId, { totalLeads: 42 });
      expect(getDashboardCache(testTenantId)).toEqual({ totalLeads: 42 });

      invalidateTenantDashboardCache(testTenantId);
      expect(getDashboardCache(testTenantId)).toBeUndefined();
    });
  });

  describe('5. KPI Calculations & Zero Division Safety', () => {
    it('gracefully evaluates to 0 and empty arrays when a tenant has zero leads', async () => {
      vi.mocked(db.query)
        // 1. Tenant lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: testTenantId,
              name: 'Empty School',
              timezone: 'Asia/Riyadh',
              data_mode: 'HYBRID_SHEET',
            },
          ],
        } as any)
        // 2. Stats query -> all zeros
        .mockResolvedValueOnce({
          rows: [
            {
              total_leads: 0,
              unique_people: 0,
              followed_count: 0,
              remaining_not_contacted: 0,
              positive_count: 0,
              pending_count: 0,
              negative_count: 0,
              not_contacted_count: 0,
              invalid_duplicate_count: 0,
              avg_days_to_contact: null,
            },
          ],
        } as any)
        // 3. Funnel query
        .mockResolvedValueOnce({
          rows: [{ stage1_completed: 0, stage2_completed: 0, stage3_completed: 0 }],
        } as any)
        // 4. Campaigns query
        .mockResolvedValueOnce({ rows: [] } as any)
        // 5. Daily intake
        .mockResolvedValueOnce({ rows: [] } as any)
        // 6. Priority leads
        .mockResolvedValueOnce({ rows: [] } as any)
        // 7. Recent activities
        .mockResolvedValueOnce({ rows: [] } as any);

      const overview = await getDashboardOverview(testTenantId, undefined, true);

      expect(overview.kpiCards.totalLeads).toBe(0);
      expect(overview.kpiCards.followedPercent).toBe(0);
      expect(overview.kpiCards.positiveRatePercent).toBe(0);
      expect(overview.kpiCards.replyRatePercent).toBe(0);
      expect(overview.kpiCards.daysToFirstContact).toBeNull();
      expect(overview.feedbackSplit.positive.percent).toBe(0);
      expect(overview.campaigns).toEqual([]);
      expect(overview.dailyIntake).toEqual([]);
    });

    it('computes accurate KPI cards, split bar, funnel, and priority leads when leads exist', async () => {
      vi.mocked(db.query)
        // 1. Tenant lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: testTenantId,
              name: 'Active School',
              timezone: 'Asia/Riyadh',
              data_mode: 'HYBRID_SHEET',
              last_synced_at: new Date().toISOString(),
            },
          ],
        } as any)
        // 2. Stats query
        .mockResolvedValueOnce({
          rows: [
            {
              total_leads: 100,
              unique_people: 90,
              followed_count: 70,
              remaining_not_contacted: 30,
              positive_count: 40,
              pending_count: 20,
              negative_count: 10,
              not_contacted_count: 30,
              invalid_duplicate_count: 5,
              pending_msg_no_reply: 10,
              pending_called_no_answer: 5,
              pending_answered_no_decision: 5,
              pending_other: 0,
              avg_days_to_contact: 1.5,
              new_leads_last_7_days: 25,
              going_cold_alert: 8,
            },
          ],
        } as any)
        // 3. Funnel query
        .mockResolvedValueOnce({
          rows: [{ stage1_completed: 70, stage2_completed: 40, stage3_completed: 20 }],
        } as any)
        // 4. Campaigns query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'camp-1',
              tab_name: 'Campaign 1',
              display_order: 0,
              total_leads: 60,
              followed_count: 45,
              positive_count: 25,
              answered_count: 35,
            },
          ],
        } as any)
        // 5. Daily intake
        .mockResolvedValueOnce({
          rows: [{ intake_date: '2026-11-20', lead_count: 15 }],
        } as any)
        // 6. Priority leads
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'lead-1',
              parent_name: 'Omar Farooq',
              phone_raw: '0501234567',
              phone_normalized: '966501234567',
              grade: 'Grade 2',
              feedback_status: 'POSITIVE',
              pending_substatus: null,
              campaign_name: 'Campaign 1',
              lead_date: '2026-11-20',
              last_updated_at: '2026-11-22T10:00:00Z',
              whatsapp_url: 'https://wa.me/966501234567',
            },
          ],
        } as any)
        // 7. Recent activities
        .mockResolvedValueOnce({ rows: [] } as any);

      const overview = await getDashboardOverview(testTenantId, undefined, true);

      expect(overview.kpiCards.totalLeads).toBe(100);
      expect(overview.kpiCards.uniquePeople).toBe(90);
      expect(overview.kpiCards.repeats).toBe(10);
      expect(overview.kpiCards.followedPercent).toBe(70);
      // Positive Rate % = 40 / (40 + 10) = 80%
      expect(overview.kpiCards.positiveRatePercent).toBe(80);
      // Reply Rate % = (40 + 10) / (70 - 5) = 50 / 65 = 77%
      expect(overview.kpiCards.replyRatePercent).toBe(77);
      expect(overview.kpiCards.daysToFirstContact).toBe(1.5);
      expect(overview.feedbackSplit.positive.percent).toBe(40);
      expect(overview.campaigns.length).toBe(1);
      expect(overview.priorityLeads.length).toBe(1);
    });
  });

  describe('6. REST Endpoints (GET /api/dashboard/overview & /campaigns)', () => {
    it('returns dashboard overview to authenticated SCHOOL_ADMIN', async () => {
      // Mock tenant query for overview
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [{ id: testTenantId, name: 'Yen School', data_mode: 'HYBRID_SHEET' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_leads: 10, followed_count: 5, positive_count: 3 }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ stage1_completed: 5 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Cookie', [`${config.cookie.name}=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('kpiCards');
      expect(res.body).toHaveProperty('feedbackSplit');
      expect(res.body).toHaveProperty('funnel');
      expect(res.body).toHaveProperty('campaigns');
    });

    it('returns dashboard overview to authenticated COUNSELOR', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [{ id: testTenantId, name: 'Yen School', data_mode: 'HYBRID_SHEET' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ total_leads: 10, followed_count: 5, positive_count: 3 }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ stage1_completed: 5 }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Cookie', [`${config.cookie.name}=${counselorToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.kpiCards.totalLeads).toBe(10);
    });

    it('returns campaigns list to authenticated user', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          { id: 'camp-1', tab_name: 'Campaign Alpha', display_order: 0, is_active: true },
          { id: 'camp-2', tab_name: 'Campaign Beta', display_order: 1, is_active: true },
        ],
      } as any);

      const res = await request(app)
        .get('/api/dashboard/campaigns')
        .set('Cookie', [`${config.cookie.name}=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].tab_name).toBe('Campaign Alpha');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/dashboard/overview');
      expect(res.status).toBe(401);
    });
  });
});
