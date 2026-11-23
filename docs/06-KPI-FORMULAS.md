# 06 — KPI & Analytics Calculation Formulas

All metrics dynamically scope to `WHERE tenant_id = :tenantId` and optionally `AND campaign_id = :campaignId`. When a tenant has 0 leads or 0 campaigns, all formulas gracefully evaluate to 0 or empty arrays without throwing division-by-zero errors.

1. **Total Leads:** `COUNT(*)` of all lead rows in scope.
   - **Unique People:** `COUNT(DISTINCT phone_normalized)` where `phone_normalized IS NOT NULL`.
   - **Repeats:** `Total Leads - Unique People`.
2. **Followed:** `COUNT(*)` where `feedback_status <> 'NOT_CONTACTED'` OR `EXISTS (SELECT 1 FROM follow_up_notes WHERE lead_id = leads.id)`.
   - **Followed %:** `ROUND((Followed / NULLIF(Total Leads, 0)) * 100)`. Evaluates to 0 if Total Leads is 0.
3. **Remaining (Not Contacted):** `COUNT(*)` where `feedback_status = 'NOT_CONTACTED'` AND no follow-up notes exist.
4. **Status Counts & Split Bar %:**
   - `Positive`: `feedback_status = 'POSITIVE'`
   - `Pending`: `feedback_status = 'PENDING'`
   - `Negative`: `feedback_status = 'NEGATIVE'`
   - `Not Contacted`: `feedback_status = 'NOT_CONTACTED'`
   - `Invalid / Duplicate`: `feedback_status = 'INVALID_DUPLICATE'`
   - Percentage for each segment: `ROUND((Segment Count / NULLIF(Total Leads, 0)) * 100)`. Evaluates to 0% if Total Leads is 0.
5. **Positive Rate %:**
   - `ROUND((Positive / NULLIF(Positive + Negative, 0)) * 100)` *(Positive out of clear Yes/No answers)*.
6. **Reply Rate %:**
   - Valid Followed Leads = `Followed - Invalid/Duplicate`.
   - Clear Yes/No Answers = `Positive + Negative`.
   - `Reply Rate % = ROUND(((Positive + Negative) / NULLIF(Valid Followed Leads, 0)) * 100)`.
7. **Days to First Contact:**
   - `ROUND(AVG(EXTRACT(EPOCH FROM (first_contact_at - lead_date::timestamp)) / 86400), 1)` for leads having both `lead_date` and `first_contact_at`. Returns null if no contacts recorded.
8. **New Leads (Last 7 Days):**
   - `COUNT(*)` where `lead_date >= (CURRENT_DATE AT TIME ZONE tenant.timezone) - INTERVAL '7 days'`.
9. **No Update in 3+ Days (Going Cold Alert):**
   - `COUNT(*)` where `feedback_status IN ('POSITIVE', 'PENDING')` AND `last_updated_at < NOW() - INTERVAL '3 days'`.
10. **Follow-Up Stage Funnel (`Stage 1`, `Stage 2`, `Stage 3`):**
    - `Stage N Completed`: `COUNT(DISTINCT lead_id)` in `follow_up_notes` where `stage >= N`.
    - `Stage N Open/Waiting`: Leads in `POSITIVE` or `PENDING` status that have completed `Stage N-1` (or `NOT_CONTACTED` for Stage 1) and are awaiting `Stage N`.
