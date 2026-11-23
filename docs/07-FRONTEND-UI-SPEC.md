# 07 — Frontend UI & Component Specification

## 1. Layout & White-Label Theme Injection
- On initial load, fetch `/api/tenant/config` and set `document.documentElement.style.setProperty('--brand-primary', config.primaryColor)`.
- Render tenant `logoUrl` and `dashboardTitle` in the top header. Zero mention of the parent SaaS brand.
- Zero hardcoded school names or static campaign titles; all branding and tabs render dynamically from the active tenant profile.

## 2. Empty-State & Zero-Data Handling
When a newly provisioned tenant has 0 campaigns or 0 leads:
- **Campaign Tabs Bar:** Shows "No campaigns yet" badge and an empty state banner guiding School Admins to sync a Google Sheet or upload leads via CSV.
- **KPI Grid:** Renders cleanly with `0` counts and `0%` metrics without rendering `NaN` or crashing.
- **Visual Analytics (Split Bar, Funnel, Matrix, Daily Intake):** Renders clean placeholder empty state banners informing the user that charts will populate once leads are imported.
- **Master Lead List:** Renders an empty table state with an "Import Leads from CSV" shortcut button.

## 3. Screen Sections (Matching Reference Dashboard)
1. **Sticky Top Bar:**
   - Smooth-scroll anchor links: `Overview` | `Follow-ups` | `Positive leads` | `Campaigns` | `Daily intake` | `Lead list`.
   - Live status pill: green pulse dot + `Live HH:mm <Timezone-City> · next <countdown>s` (counts down `60s -> 0s`, triggers React Query refetch, and resets).
2. **Campaign Tabs Bar:**
   - Pill tabs: `All campaign tabs [Total]` followed by one pill per active `campaign` dynamically loaded from database (`<Tab Name> [Lead Count]`). Selecting a pill updates global `selectedCampaignId` filter state.
3. **Overview & KPI Grid:**
   - Dynamic summary sentence: *"<Total> leads across <N> campaign tabs. <Followed> have been followed up and <Remaining> have no first follow-up yet..."*
   - KPI Cards: Total Leads, Followed, Remaining, Positive, Negative, Pending.
   - Pending Sub-Breakdown Card: `Message sent, no reply`, `Called, no answer`, `Answered, no decision`, `Other`.
   - Velocity Cards: `Positive rate %`, `Reply rate %`, `Days to first contact`, `New leads, last 7 days`, `No update in 3+ days` (clickable to filter cold leads).
4. **Interactive Visual Bars & Charts:**
   - **Feedback Split Bar:** Horizontal stacked bar; clicking any segment sets the `status` filter and scrolls to the Lead List.
   - **Follow-up Progress Funnel:** 4-step visual funnel (`Leads received -> Followup - 1 -> Followup - 2 -> Followup - 3`); clicking a stage filters open leads waiting for that stage.
   - **Campaign Performance Table:** Columns `CAMPAIGN TAB | LEADS | FOLLOWUP 1 | FOLLOWUP 2 | FOLLOWUP 3 | REMAINING | POSITIVE | NEGATIVE | PENDING | INVALID/DUP.`. Clicking a row selects that campaign tab.
   - **Daily Intake Bar Chart:** Vertical bar chart of daily lead counts grouped by date.
5. **Positive Leads to Close (Action Card Grid):**
   - Cards sorted by `last_updated_at ASC` (oldest update first).
   - Card anatomy:
     - Parent Name (`dir="auto"` so Arabic names right-align naturally).
     - Subtitle: `<Campaign Tab> · <Grade>`.
     - Latest note snippet (2–3 lines max).
     - Green WhatsApp pill button (`https://wa.me/<phone_normalized>`) with WhatsApp icon + raw phone number.
     - Footer aging text in red/amber: `Updated X Nov · Yd ago`.
6. **Master Lead List & Follow-Up Drawer:**
   - Filter pills (`Open`, `All`, `Positive`, `Pending`, `Not contacted`, `Negative`, `Invalid / duplicate`), search box (`Search names, phones, notes...`), Grade dropdown, and `Clear search and filters` button.
   - Sortable table columns: `FEEDBACK | NAME | CONTACT | CAMPAIGN TAB | LEAD DATE | LAST UPDATE | LATEST NOTE`.
   - **Slide-Over Lead Drawer:** Opens on row/card click; shows full chronological timeline of `follow_up_notes` (`Stage 1`, `2`, `3+`, agent name, timestamp, source badge) and a form to post a new follow-up note + update status.
   - Collapsible accordion at page bottom: `> How the numbers are worked out` displaying the plain-English KPI formula explanations.
