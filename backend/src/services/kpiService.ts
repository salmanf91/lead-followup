import { query } from '../db/index.js';
import { getDashboardCache, setDashboardCache } from './dashboardCache.js';

export interface DashboardOverview {
  kpiCards: {
    totalLeads: number;
    uniquePeople: number;
    repeats: number;
    followedCount: number;
    followedPercent: number;
    remainingNotContacted: number;
    positiveCount: number;
    positiveRatePercent: number;
    negativeCount: number;
    pendingCount: number;
    replyRatePercent: number;
    daysToFirstContact: number | null;
    newLeadsLast7Days: number;
    goingColdAlertCount: number;
  };
  feedbackSplit: {
    positive: { count: number; percent: number };
    pending: { count: number; percent: number };
    negative: { count: number; percent: number };
    notContacted: { count: number; percent: number };
    invalidDuplicate: { count: number; percent: number };
  };
  pendingBreakdown: {
    msgNoReply: { count: number; percent: number };
    calledNoAnswer: { count: number; percent: number };
    answeredNoDecision: { count: number; percent: number };
    other: { count: number; percent: number };
  };
  funnel: {
    stage1: { completed: number; openWaiting: number };
    stage2: { completed: number; openWaiting: number };
    stage3: { completed: number; openWaiting: number };
  };
  campaigns: Array<{
    id: string;
    tabName: string;
    displayOrder: number;
    totalLeads: number;
    followedCount: number;
    followedPercent: number;
    positiveCount: number;
    positiveRatePercent: number;
  }>;
  dailyIntake: Array<{
    date: string;
    count: number;
  }>;
  priorityLeads: Array<{
    id: string;
    parentName: string;
    phoneRaw: string | null;
    phoneNormalized: string | null;
    grade: string | null;
    feedbackStatus: string;
    pendingSubstatus: string | null;
    campaignName: string;
    leadDate: string | null;
    lastUpdatedAt: string;
    whatsAppUrl: string | null;
  }>;
  syncInfo: {
    lastSyncedAt: string | null;
    lastSyncError: string | null;
    dataMode: string;
    googleSheetId: string | null;
  };
}

/**
 * Calculates all KPI cards, breakdowns, funnel, and campaign statistics for a tenant.
 * Uses 60-second LRU cache and guarantees zero-division safety.
 */
export async function getDashboardOverview(
  tenantId: string,
  campaignId?: string | null,
  bypassCache = false
): Promise<DashboardOverview> {
  const normCampaignId = campaignId && campaignId !== 'ALL' ? campaignId : undefined;

  // Check LRU Cache
  if (!bypassCache) {
    const cached = getDashboardCache<DashboardOverview>(tenantId, normCampaignId);
    if (cached) {
      return cached;
    }
  }

  // 1. Fetch tenant metadata
  const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
  if (tenantRes.rows.length === 0) {
    throw new Error('Tenant not found');
  }
  const tenant = tenantRes.rows[0];

  // Build WHERE clause
  const scopeParams: any[] = [tenantId];
  let campaignFilter = '';
  if (normCampaignId) {
    scopeParams.push(normCampaignId);
    campaignFilter = ' AND campaign_id = $2';
  }

  // 2. Aggregate Lead Totals & Statuses
  const statsRes = await query(
    `SELECT
       COUNT(*)::int AS total_leads,
       COUNT(DISTINCT phone_normalized) FILTER (WHERE phone_normalized IS NOT NULL)::int AS unique_people,
       COUNT(*) FILTER (WHERE feedback_status <> 'NOT_CONTACTED' OR EXISTS (SELECT 1 FROM follow_up_notes WHERE lead_id = leads.id))::int AS followed_count,
       COUNT(*) FILTER (WHERE feedback_status = 'NOT_CONTACTED' AND NOT EXISTS (SELECT 1 FROM follow_up_notes WHERE lead_id = leads.id))::int AS remaining_not_contacted,
       COUNT(*) FILTER (WHERE feedback_status = 'POSITIVE')::int AS positive_count,
       COUNT(*) FILTER (WHERE feedback_status = 'PENDING')::int AS pending_count,
       COUNT(*) FILTER (WHERE feedback_status = 'NEGATIVE')::int AS negative_count,
       COUNT(*) FILTER (WHERE feedback_status = 'NOT_CONTACTED')::int AS not_contacted_count,
       COUNT(*) FILTER (WHERE feedback_status = 'INVALID_DUPLICATE')::int AS invalid_duplicate_count,
       COUNT(*) FILTER (WHERE pending_substatus = 'MSG_NO_REPLY')::int AS pending_msg_no_reply,
       COUNT(*) FILTER (WHERE pending_substatus = 'CALLED_NO_ANSWER')::int AS pending_called_no_answer,
       COUNT(*) FILTER (WHERE pending_substatus = 'ANSWERED_NO_DECISION')::int AS pending_answered_no_decision,
       COUNT(*) FILTER (WHERE pending_substatus = 'OTHER')::int AS pending_other,
       COUNT(*) FILTER (WHERE lead_date >= (CURRENT_DATE - INTERVAL '7 days'))::int AS new_leads_last_7_days,
       COUNT(*) FILTER (WHERE feedback_status IN ('POSITIVE', 'PENDING') AND last_updated_at < NOW() - INTERVAL '3 days')::int AS going_cold_alert,
       ROUND(AVG(EXTRACT(EPOCH FROM (first_contact_at - lead_date::timestamp)) / 86400)::numeric, 1)::float AS avg_days_to_contact
     FROM leads
     WHERE tenant_id = $1 ${campaignFilter}`,
    scopeParams
  );

  const row = statsRes.rows[0] || {};
  const totalLeads = Number(row.total_leads || 0);
  const uniquePeople = Number(row.unique_people || 0);
  const repeats = Math.max(0, totalLeads - uniquePeople);
  const followedCount = Number(row.followed_count || 0);
  const followedPercent = totalLeads > 0 ? Math.round((followedCount / totalLeads) * 100) : 0;
  const remainingNotContacted = Number(row.remaining_not_contacted || 0);

  const positiveCount = Number(row.positive_count || 0);
  const pendingCount = Number(row.pending_count || 0);
  const negativeCount = Number(row.negative_count || 0);
  const notContactedCount = Number(row.not_contacted_count || 0);
  const invalidDuplicateCount = Number(row.invalid_duplicate_count || 0);

  // Positive Rate % = Positive / (Positive + Negative)
  const clearYesNoAnswers = positiveCount + negativeCount;
  const positiveRatePercent =
    clearYesNoAnswers > 0 ? Math.round((positiveCount / clearYesNoAnswers) * 100) : 0;

  // Reply Rate % = (Positive + Negative) / (Followed - Invalid/Duplicate)
  const validFollowed = Math.max(0, followedCount - invalidDuplicateCount);
  const replyRatePercent =
    validFollowed > 0 ? Math.round((clearYesNoAnswers / validFollowed) * 100) : 0;

  const daysToFirstContact = row.avg_days_to_contact !== null ? Number(row.avg_days_to_contact) : null;
  const newLeadsLast7Days = Number(row.new_leads_last_7_days || 0);
  const goingColdAlertCount = Number(row.going_cold_alert || 0);

  // Percent calculations helper (safe zero-division)
  const calcPercent = (count: number) => (totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0);
  const calcPendingPercent = (count: number) =>
    pendingCount > 0 ? Math.round((count / pendingCount) * 100) : 0;

  // 3. Follow-up Stage Funnel (Stages 1, 2, 3)
  const funnelRes = await query(
    `SELECT
       COUNT(DISTINCT lead_id) FILTER (WHERE stage >= 1)::int AS stage1_completed,
       COUNT(DISTINCT lead_id) FILTER (WHERE stage >= 2)::int AS stage2_completed,
       COUNT(DISTINCT lead_id) FILTER (WHERE stage >= 3)::int AS stage3_completed
     FROM follow_up_notes fn
     JOIN leads l ON l.id = fn.lead_id
     WHERE fn.tenant_id = $1 ${campaignFilter}`,
    scopeParams
  );
  const funnelRow = funnelRes.rows[0] || {};
  const stage1Completed = Number(funnelRow.stage1_completed || 0);
  const stage2Completed = Number(funnelRow.stage2_completed || 0);
  const stage3Completed = Number(funnelRow.stage3_completed || 0);

  // Open / waiting stages
  const stage1Waiting = remainingNotContacted;
  const stage2Waiting = Math.max(0, stage1Completed - stage2Completed);
  const stage3Waiting = Math.max(0, stage2Completed - stage3Completed);

  // 4. Campaign Matrix
  const campaignsRes = await query(
    `SELECT
       c.id,
       c.tab_name,
       c.display_order,
       COUNT(l.id)::int AS total_leads,
       COUNT(l.id) FILTER (WHERE l.feedback_status <> 'NOT_CONTACTED' OR EXISTS (SELECT 1 FROM follow_up_notes WHERE lead_id = l.id))::int AS followed_count,
       COUNT(l.id) FILTER (WHERE l.feedback_status = 'POSITIVE')::int AS positive_count,
       COUNT(l.id) FILTER (WHERE l.feedback_status IN ('POSITIVE', 'NEGATIVE'))::int AS answered_count
     FROM campaigns c
     LEFT JOIN leads l ON l.campaign_id = c.id
     WHERE c.tenant_id = $1 AND c.is_active = true
     GROUP BY c.id, c.tab_name, c.display_order
     ORDER BY c.display_order ASC, c.tab_name ASC`,
    [tenantId]
  );

  const campaigns = campaignsRes.rows.map((c) => {
    const campTotal = Number(c.total_leads || 0);
    const campFollowed = Number(c.followed_count || 0);
    const campPositive = Number(c.positive_count || 0);
    const campAnswered = Number(c.answered_count || 0);

    return {
      id: c.id,
      tabName: c.tab_name,
      displayOrder: Number(c.display_order || 0),
      totalLeads: campTotal,
      followedCount: campFollowed,
      followedPercent: campTotal > 0 ? Math.round((campFollowed / campTotal) * 100) : 0,
      positiveCount: campPositive,
      positiveRatePercent: campAnswered > 0 ? Math.round((campPositive / campAnswered) * 100) : 0,
    };
  });

  // 5. Daily Lead Intake Timeline (Last 30 Days)
  const intakeRes = await query(
    `SELECT
       COALESCE(lead_date, created_at::date)::text AS intake_date,
       COUNT(*)::int AS lead_count
     FROM leads
     WHERE tenant_id = $1 ${campaignFilter}
       AND COALESCE(lead_date, created_at::date) >= CURRENT_DATE - INTERVAL '30 days'
     GROUP BY intake_date
     ORDER BY intake_date ASC`,
    scopeParams
  );
  const dailyIntake = intakeRes.rows.map((r) => ({
    date: r.intake_date,
    count: Number(r.lead_count || 0),
  }));

  // 6. Priority Leads for Immediate Counselor Follow-Up (WhatsApp ready)
  const priorityRes = await query(
    `SELECT
       l.id,
       l.parent_name,
       l.phone_raw,
       l.phone_normalized,
       l.grade,
       l.feedback_status,
       l.pending_substatus,
       c.tab_name AS campaign_name,
       l.lead_date::text,
       l.last_updated_at::text,
       CASE WHEN l.phone_normalized IS NOT NULL THEN 'https://wa.me/' || l.phone_normalized ELSE NULL END AS whatsapp_url
     FROM leads l
     JOIN campaigns c ON c.id = l.campaign_id
     WHERE l.tenant_id = $1 ${campaignFilter}
       AND l.feedback_status IN ('POSITIVE', 'PENDING', 'NOT_CONTACTED')
     ORDER BY
       CASE l.feedback_status
         WHEN 'POSITIVE' THEN 1
         WHEN 'PENDING' THEN 2
         ELSE 3
       END,
       l.last_updated_at ASC
     LIMIT 8`,
    scopeParams
  );

  const priorityLeads = priorityRes.rows.map((p) => ({
    id: p.id,
    parentName: p.parent_name,
    phoneRaw: p.phone_raw,
    phoneNormalized: p.phone_normalized,
    grade: p.grade,
    feedbackStatus: p.feedback_status,
    pendingSubstatus: p.pending_substatus,
    campaignName: p.campaign_name,
    leadDate: p.lead_date,
    lastUpdatedAt: p.last_updated_at,
    whatsAppUrl: p.whatsapp_url,
  }));

  const result: DashboardOverview = {
    kpiCards: {
      totalLeads,
      uniquePeople,
      repeats,
      followedCount,
      followedPercent,
      remainingNotContacted,
      positiveCount,
      positiveRatePercent,
      negativeCount,
      pendingCount,
      replyRatePercent,
      daysToFirstContact,
      newLeadsLast7Days,
      goingColdAlertCount,
    },
    feedbackSplit: {
      positive: { count: positiveCount, percent: calcPercent(positiveCount) },
      pending: { count: pendingCount, percent: calcPercent(pendingCount) },
      negative: { count: negativeCount, percent: calcPercent(negativeCount) },
      notContacted: { count: notContactedCount, percent: calcPercent(notContactedCount) },
      invalidDuplicate: { count: invalidDuplicateCount, percent: calcPercent(invalidDuplicateCount) },
    },
    pendingBreakdown: {
      msgNoReply: {
        count: Number(row.pending_msg_no_reply || 0),
        percent: calcPendingPercent(Number(row.pending_msg_no_reply || 0)),
      },
      calledNoAnswer: {
        count: Number(row.pending_called_no_answer || 0),
        percent: calcPendingPercent(Number(row.pending_called_no_answer || 0)),
      },
      answeredNoDecision: {
        count: Number(row.pending_answered_no_decision || 0),
        percent: calcPendingPercent(Number(row.pending_answered_no_decision || 0)),
      },
      other: {
        count: Number(row.pending_other || 0),
        percent: calcPendingPercent(Number(row.pending_other || 0)),
      },
    },
    funnel: {
      stage1: { completed: stage1Completed, openWaiting: stage1Waiting },
      stage2: { completed: stage2Completed, openWaiting: stage2Waiting },
      stage3: { completed: stage3Completed, openWaiting: stage3Waiting },
    },
    campaigns,
    dailyIntake,
    priorityLeads,
    syncInfo: {
      lastSyncedAt: tenant.last_synced_at ? new Date(tenant.last_synced_at).toISOString() : null,
      lastSyncError: tenant.last_sync_error,
      dataMode: tenant.data_mode,
      googleSheetId: tenant.google_sheet_id,
    },
  };

  // Cache result for 60 seconds
  setDashboardCache(tenantId, result, normCampaignId);

  return result;
}
