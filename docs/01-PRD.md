# 01 — Product Requirements Document (PRD)

## 1. User Roles & Permissions (RBAC)

### A. Super Admin (`SUPER_ADMIN`)
- **Access:** Private portal at `admin.<domain>.com`.
- **Capabilities:**
  - Create, edit, activate, or suspend school tenants.
  - Configure silent white-labeling per school: `logo_url`, `primary_color`, `dashboard_title`, `slug` (subdomain), and `timezone` (e.g., `Asia/Riyadh`).
  - Configure data ingestion mode (`HYBRID_SHEET` or `NATIVE_ONLY`), Google Sheet ID, tab mappings, and status keyword rules.
  - Track manual billing/licensing (`ONE_TIME` or `ANNUAL`, `renewal_date`, internal `admin_notes`).
  - Provision initial `SCHOOL_ADMIN` accounts and use one-click "Login as School" impersonation for support.

### B. School Admin (`SCHOOL_ADMIN`)
- **Access:** Branded subdomain `<school-slug>.<domain>.com`.
- **Capabilities:**
  - Full access to their school's live dashboard, all campaign tabs, KPIs, and conversion funnels.
  - Create, deactivate, and manage `COUNSELOR` accounts for their school.
  - Upload leads via CSV/Excel and export filtered lead lists to CSV.
  - View counselor attribution and activity across all leads.

### C. Counselor (`COUNSELOR`)
- **Access:** Branded subdomain `<school-slug>.<domain>.com`.
- **Capabilities:**
  - View leads, filter by status/campaign/grade, and search by name, phone, or note text.
  - Click one-tap WhatsApp buttons (`https://wa.me/<normalized_phone>`) to message parents.
  - Open any lead's Follow-Up Drawer to change status (`POSITIVE`, `PENDING`, `NEGATIVE`, `INVALID_DUPLICATE`) and log timestamped notes attributed automatically to their user account.
  - Restricted from CSV bulk imports/exports and user management.

## 2. Core Functional Modules
1. **Top Navigation & Live Countdown Bar:** Sticky section links (*Overview, Follow-ups, Positive leads, Campaigns, Daily intake, Lead list*), live tenant local clock, and 60-second auto-refresh countdown timer with manual refresh trigger.
2. **Dynamic Campaign Tabs:** Filter the entire dashboard by *All Campaign Tabs* or any individual tab (e.g., `Al-Khobar`, `Dhaharan-Aziziya`, `Khobar - 17 MI`, `Campaign - 4 (9-12)`, `Kg - campaign 5`) with live lead counts.
3. **KPI & Health Cards:** Total Leads (Unique vs. Repeat/Duplicate), Followed (count & %), Remaining, Positive, Negative, Pending (with sub-breakdown: *Message sent / no reply*, *Called / no answer*, *Answered / no decision*, *Other*), Positive Rate %, Reply Rate %, Days to First Contact, New Leads (Last 7 Days), and Going Cold Alert (`3+ days` without update).
4. **Interactive Visual Analytics:**
   - Clickable **Feedback Split Bar** (filters lead list on segment click).
   - Clickable **Follow-Up Stage Funnel** (*Leads Received -> Followup 1 -> Followup 2 -> Followup 3*) showing completion % and open/waiting counts.
   - Clickable **Campaign Performance Matrix** table.
   - **Daily Intake Bar Chart** grouped by `lead_date`.
5. **Positive Leads to Close Card Grid:** High-intent leads sorted oldest-update-first with LTR/RTL parent name, campaign + grade tag, latest note, aging badge (`Updated X Nov · Yd ago`), and 1-click WhatsApp button.
6. **Master Lead List & Slide-Over Follow-Up Drawer:** Searchable, sortable table with status filter pills and a slide-over drawer displaying full chronological notes (`Followup 1/2/3+`) plus an in-app note submission form.
