import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { config } from '../config/index.js';
import * as db from '../db/index.js';
import { defaultSheetsService } from '../services/googleSheetsService.js';
import { writeBackNoteToSheet } from '../services/writebackService.js';

vi.mock('../db/index.js', () => ({
  pool: {
    query: vi.fn(),
    on: vi.fn(),
  },
  query: vi.fn(),
  withTransaction: vi.fn(),
  checkDbConnection: vi.fn().mockResolvedValue(true),
}));

describe('Milestone 5 — Lead Management, Write-Back & School Admin APIs', () => {
  const app = createApp();
  const testTenantId = 'tenant-m5-test-uuid';
  const otherTenantId = 'tenant-other-uuid';

  const schoolAdminToken = jwt.sign(
    {
      userId: 'user-school-admin-1',
      email: 'admin@school.edu',
      role: 'SCHOOL_ADMIN',
      tenantId: testTenantId,
      name: 'School Admin',
    },
    config.jwt.secret
  );

  const counselorToken = jwt.sign(
    {
      userId: 'user-counselor-1',
      email: 'counselor@school.edu',
      role: 'COUNSELOR',
      tenantId: testTenantId,
      name: 'Counselor Sara',
    },
    config.jwt.secret
  );

  const superAdminToken = jwt.sign(
    {
      userId: 'user-super-admin',
      email: 'super@antigravity.sa',
      role: 'SUPER_ADMIN',
      tenantId: null,
      name: 'Super Admin',
    },
    config.jwt.secret
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Master Lead List (GET /api/leads)', () => {
    it('blocks unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/leads');
      expect(res.status).toBe(401);
    });

    it('returns paginated leads filtered by tenant_id', async () => {
      // Mock count query
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('COUNT(*)::int as total')) {
          expect(params[0]).toBe(testTenantId);
          return Promise.resolve({ rows: [{ total: 1 }] });
        }
        if (sql.includes('FROM leads l')) {
          expect(params[0]).toBe(testTenantId);
          return Promise.resolve({
            rows: [
              {
                id: 'lead-1',
                tenant_id: testTenantId,
                campaign_id: 'camp-1',
                campaign_tab: 'Kindergarten 2026',
                parent_name: 'Ahmad Al-Mansour',
                phone_raw: '0501234567',
                phone_normalized: '966501234567',
                grade: 'KG1',
                feedback_status: 'PENDING',
                pending_substatus: 'MSG_NO_REPLY',
                is_duplicate: false,
                lead_date: '2026-11-20',
                first_contact_at: '2026-11-21T10:00:00Z',
                last_updated_at: '2026-11-21T10:00:00Z',
                notes_count: 1,
                latest_note: {
                  id: 'note-1',
                  stage: 1,
                  note_text: 'Sent welcome WhatsApp message',
                  counselor_tag: 'Counselor Sara',
                  source: 'WEB_APP',
                },
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/leads?page=1&limit=25')
        .set('Cookie', `token=${counselorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.leads).toHaveLength(1);
      expect(res.body.leads[0].parent_name).toBe('Ahmad Al-Mansour');
      expect(res.body.leads[0].latest_note.stage).toBe(1);
    });

    it('applies search, status, and campaign filters correctly', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('COUNT(*)::int as total')) {
          expect(sql).toContain('l.campaign_id = $2');
          expect(sql).toContain('l.feedback_status = $3');
          expect(sql).toContain('l.parent_name ILIKE $4');
          return Promise.resolve({ rows: [{ total: 5 }] });
        }
        if (sql.includes('FROM leads l')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/leads?campaignId=camp-1&status=POSITIVE&search=Ahmad')
        .set('Cookie', `token=${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
    });
  });

  describe('2. Lead Detail & Note Logging (GET /api/leads/:id & POST /api/leads/:id/notes)', () => {
    it('returns lead details with full chronological notes', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM leads l') && sql.includes('WHERE l.id = $1')) {
          expect(params[0]).toBe('lead-1');
          expect(params[1]).toBe(testTenantId);
          return Promise.resolve({
            rows: [
              {
                id: 'lead-1',
                tenant_id: testTenantId,
                parent_name: 'Fatima Al-Zahrani',
                phone_normalized: '966551122334',
                feedback_status: 'POSITIVE',
              },
            ],
          });
        }
        if (sql.includes('FROM follow_up_notes')) {
          return Promise.resolve({
            rows: [
              { id: 'n1', stage: 1, note_text: 'Called, interested', counselor_tag: 'Sara' },
              { id: 'n2', stage: 2, note_text: 'School tour booked', counselor_tag: 'Sara' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/leads/lead-1')
        .set('Cookie', `token=${counselorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lead.parent_name).toBe('Fatima Al-Zahrani');
      expect(res.body.notes).toHaveLength(2);
      expect(res.body.notes[1].note_text).toBe('School tour booked');
    });

    it('returns 404 when lead does not belong to the requesting tenant', async () => {
      (db.query as any).mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get('/api/leads/lead-from-other-tenant')
        .set('Cookie', `token=${counselorToken}`);

      expect(res.status).toBe(404);
    });

    it('adds a new note, updates status, and sets status_updated_by_app', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        // Lead existence check
        if (sql.includes('SELECT id, first_contact_at, feedback_status')) {
          return Promise.resolve({
            rows: [{ id: 'lead-1', first_contact_at: null, feedback_status: 'NOT_CONTACTED' }],
          });
        }
        // Insert note
        if (sql.includes('INSERT INTO follow_up_notes')) {
          expect(params[3]).toBe(1); // stage
          expect(params[4]).toBe('Parent visited school, very interested'); // text
          expect(params[5]).toBe('Counselor Sara'); // counselor tag
          return Promise.resolve({
            rows: [{ id: 'new-note-1', stage: 1, note_text: params[4], source: 'WEB_APP' }],
          });
        }
        // Update lead
        if (sql.includes('UPDATE leads')) {
          expect(params[0]).toBe('POSITIVE'); // feedback_status
          return Promise.resolve({
            rows: [{ id: 'lead-1', feedback_status: 'POSITIVE', status_updated_by_app: true }],
          });
        }
        // Tenant check for writeback
        if (sql.includes('SELECT enable_sheet_writeback')) {
          return Promise.resolve({ rows: [{ enable_sheet_writeback: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/leads/lead-1/notes')
        .set('Cookie', `token=${counselorToken}`)
        .send({
          stage: 1,
          noteText: 'Parent visited school, very interested',
          feedbackStatus: 'POSITIVE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.note.stage).toBe(1);
      expect(res.body.lead.feedback_status).toBe('POSITIVE');
    });

    it('rejects adding a note with missing stage or empty text', async () => {
      const res = await request(app)
        .post('/api/leads/lead-1/notes')
        .set('Cookie', `token=${counselorToken}`)
        .send({ stage: 0, noteText: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('3. Quick Status Update (PATCH /api/leads/:id/status)', () => {
    it('updates lead feedback_status and pending_substatus directly', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE leads')) {
          expect(params[0]).toBe('PENDING');
          expect(params[1]).toBe('CALLED_NO_ANSWER');
          return Promise.resolve({
            rows: [{ id: 'lead-1', feedback_status: 'PENDING', pending_substatus: 'CALLED_NO_ANSWER' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .patch('/api/leads/lead-1/status')
        .set('Cookie', `token=${counselorToken}`)
        .send({
          feedbackStatus: 'PENDING',
          pendingSubstatus: 'CALLED_NO_ANSWER',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.lead.feedback_status).toBe('PENDING');
      expect(res.body.lead.pending_substatus).toBe('CALLED_NO_ANSWER');
    });
  });

  describe('4. School Admin Only Endpoints (RBAC & Counselor Management)', () => {
    it('denies COUNSELOR role access to /api/school-admin/users with 403', async () => {
      const res = await request(app)
        .get('/api/school-admin/users')
        .set('Cookie', `token=${counselorToken}`);

      expect(res.status).toBe(403);
    });

    it('allows SCHOOL_ADMIN to list counselors', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM users') && sql.includes('tenant_id = $1')) {
          expect(params[0]).toBe(testTenantId);
          return Promise.resolve({
            rows: [
              { id: 'u1', name: 'Sara', email: 'sara@school.edu', role: 'COUNSELOR', is_active: true },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/school-admin/users')
        .set('Cookie', `token=${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe('sara@school.edu');
    });

    it('creates a new counselor under the current tenant', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM users WHERE email')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO users')) {
          expect(params[0]).toBe(testTenantId);
          expect(params[1]).toBe('New Counselor');
          expect(params[2]).toBe('new@school.edu');
          return Promise.resolve({
            rows: [{ id: 'u2', name: 'New Counselor', email: 'new@school.edu', role: 'COUNSELOR' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/school-admin/users')
        .set('Cookie', `token=${schoolAdminToken}`)
        .send({
          name: 'New Counselor',
          email: 'new@school.edu',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('new@school.edu');
    });

    it('toggles counselor active status', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id, role FROM users')) {
          return Promise.resolve({ rows: [{ id: 'u1', role: 'COUNSELOR' }] });
        }
        if (sql.includes('UPDATE users SET')) {
          return Promise.resolve({ rows: [{ id: 'u1', is_active: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .patch('/api/school-admin/users/u1')
        .set('Cookie', `token=${schoolAdminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.user.is_active).toBe(false);
    });
  });

  describe('5. CSV Import & Export', () => {
    it('imports leads from CSV with phone normalization and duplicate detection', async () => {
      const csvText = `Parent Name,Phone,Grade,Campaign,Feedback,Followup - 1\n` +
        `Ali Al-Ghamdi,0501112233,Grade 1,Admissions 2026,Interested,15.11.2026 | Spoke to father (Sara)\n` +
        `Fatima Al-Harbi,+966509998877,KG2,Admissions 2026,Will visit,\n`;

      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id, tab_name FROM campaigns')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO campaigns')) {
          return Promise.resolve({ rows: [{ id: 'camp-csv-1' }] });
        }
        if (sql.includes('SELECT phone_normalized FROM leads')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO leads')) {
          return Promise.resolve({ rows: [{ id: 'lead-csv-new' }] });
        }
        if (sql.includes('INSERT INTO follow_up_notes')) {
          return Promise.resolve({ rows: [{ id: 'note-csv-1' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/school-admin/leads/import-csv')
        .set('Cookie', `token=${schoolAdminToken}`)
        .send({ csvText });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.importedCount).toBe(2);
      expect(res.body.duplicateCount).toBe(0);
    });

    it('robustly imports CSV with title header row, Remarks column, and trailing empty comma lines', async () => {
      const complexCsv =
        `Dhaharan - Aziziya Leads,,,,,,,,,,,,,,,,,,,,,,,,,,\n` +
        `Sr. no,Date,Name,Email,phone,Grade,City,Followup -1,Followup - 2,Followup - 3,Remarks,,,,,,,,,,,,,,,,\n` +
        `1,4/11/2026,Ayesha Shahroz,ayeshakashaf35@gmail.com,966501561803,kg,Al khobar,04.11.2026 not intrested,-,-,dead lead,,,,,,,,,,,,,,,,\n` +
        `2,4/11/2026,Nida Saneen,nidarash07@gmail.com,966534363007,kg,Khobar,08.11.2026 welcome message,15/11/2026 | lives in riyad (Turki),,dead lead,,,,,,,,,,,,,,,,\n` +
        `,,,,,,,,,,,,,,,,,,,,,,,,,,\n` +
        `,,,,,,,,,,,,,,,,,,,,,,,,,,\n`;

      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id, tab_name FROM campaigns')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO campaigns')) {
          return Promise.resolve({ rows: [{ id: 'camp-csv-detected' }] });
        }
        if (sql.includes('SELECT phone_normalized FROM leads')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO leads')) {
          return Promise.resolve({ rows: [{ id: 'lead-csv-detected' }] });
        }
        if (sql.includes('INSERT INTO follow_up_notes')) {
          return Promise.resolve({ rows: [{ id: 'note-csv-detected' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/school-admin/leads/import-csv')
        .set('Cookie', `token=${schoolAdminToken}`)
        .send({ csvText: complexCsv });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.importedCount).toBe(2);
      expect(res.body.totalProcessed).toBe(2);
    });

    it('exports tenant leads as RFC 4180 CSV with attachment header', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT') && sql.includes('FROM leads l')) {
          return Promise.resolve({
            rows: [
              {
                id: 'lead-1',
                campaign: 'Spring 2026',
                parent_name: 'Khalid Al-Otaibi',
                phone_raw: '0555555555',
                phone_normalized: '966555555555',
                grade: 'Grade 4',
                feedback_status: 'POSITIVE',
                pending_substatus: null,
                is_duplicate: false,
                lead_date: '2026-11-20',
                first_contact_at: '2026-11-21T10:00:00Z',
                last_updated_at: '2026-11-21T10:00:00Z',
                all_notes: '15.11.2026 | Note 1 | 16.11.2026 | Note 2',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/school-admin/leads/export-csv')
        .set('Cookie', `token=${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.text).toContain('Parent Name');
      expect(res.text).toContain('Khalid Al-Otaibi');
      expect(res.text).toContain('966555555555');
    });
  });

  describe('6. Google Sheet Two-Way Write-Back Service', () => {
    it('skips write-back when enable_sheet_writeback is false', async () => {
      (db.query as any).mockResolvedValue({
        rows: [{ enable_sheet_writeback: false, google_sheet_id: 'sheet-123' }],
      });

      const result = await writeBackNoteToSheet({
        tenantId: testTenantId,
        leadId: 'lead-1',
        stage: 1,
        noteText: 'Test note',
        counselorName: 'Sara',
      });

      expect(result).toBe(false);
    });

    it('writes back formatted note to correct stage column when enabled', async () => {
      (db.query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT enable_sheet_writeback')) {
          return Promise.resolve({
            rows: [{ enable_sheet_writeback: true, google_sheet_id: 'sheet-123', timezone: 'Asia/Riyadh' }],
          });
        }
        if (sql.includes('SELECT l.sheet_row_number')) {
          return Promise.resolve({
            rows: [{ sheet_row_number: 14, tab_name: 'Admissions' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const mockGetRange = vi.fn().mockImplementation((sheetId: string, range: string) => {
        if (range.includes('A1:Z1')) {
          return Promise.resolve([['Date', 'Name', 'Phone', 'Grade', 'Feedback', 'Followup - 1', 'Followup - 2']]);
        }
        return Promise.resolve([['']]); // existing cell is empty
      });
      const mockUpdateCell = vi.fn().mockResolvedValue(undefined);

      defaultSheetsService.getSheetRange = mockGetRange;
      defaultSheetsService.updateSheetCell = mockUpdateCell;

      const result = await writeBackNoteToSheet({
        tenantId: testTenantId,
        leadId: 'lead-1',
        stage: 1,
        noteText: 'Called parent, admission scheduled',
        counselorName: 'Sara',
      });

      expect(result).toBe(true);
      expect(mockUpdateCell).toHaveBeenCalled();
      const calledRange = mockUpdateCell.mock.calls[0][1];
      const calledVal = mockUpdateCell.mock.calls[0][2];

      // Col F is index 5 ('Followup - 1'), row 14 -> 'Admissions'!F14
      expect(calledRange).toBe("'Admissions'!F14");
      expect(calledVal).toContain('Called parent, admission scheduled');
      expect(calledVal).toContain('(Sara)');
    });
  });
});
