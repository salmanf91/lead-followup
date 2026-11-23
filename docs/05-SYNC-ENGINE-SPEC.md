# 05 — Hybrid Sync Engine & Regex Parser Specification

## 1. Expected Google Sheet Structure
Each mapped tab in the connected Google Sheet represents a **Campaign** dynamically discovered from the sheet tabs.
Standard columns (case-insensitive header matching):
- `Date` (Lead intake date)
- `Name` (Parent/Student name in Arabic or English)
- `Phone` (Raw phone number)
- `Grade` (e.g., `KG1`, `Grade 1-3`, `Grade 7-9`, `Grade 10-12`)
- `Feedback` (Overall status label)
- `Followup - 1`, `Followup - 2`, `Followup - 3` (Dated counselor notes)

## 2. Normalization & Deduplication Rules
- **Phone Normalization:** Strip spaces, `+`, `-`, `(`, `)`, and prefixes like `p:`. Standardize local Saudi numbers starting with `05xxxxxxxx` to `9665xxxxxxxx` so WhatsApp links (`https://wa.me/9665xxxxxxxx`) work reliably.
- **Row Fingerprint:** `sha256(tenantId + ':' + tabName + ':' + rowIndex)` for updating existing rows cleanly.
- **Duplicate Lead Detection:** If `phone_normalized` already exists under the same `tenant_id` on an earlier row/tab, flag subsequent occurrences with `is_duplicate = true` (and `feedback_status = 'INVALID_DUPLICATE'` if marked invalid/duplicate in sheet).

## 3. Note, Date & Agent Tag Parser
Free-text cells in `Followup - 1/2/3` often contain multiple pipe-separated entries, e.g.:
`16.11.2026 | sent a reminder (counselor_name) | 17.11.2026 | answered | interested in admission (counselor_name)`
- **Date Regex:** `/(\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b)/` -> Parse to ISO timestamp.
- **Counselor Tag Regex:** `/\(([^)]+)\)\s*$/` -> Extracts `(name)` as `counselor_tag`.
- **Keyword Status Classifier (Configurable per Tenant via JSONB):**
  - `POSITIVE`: `["interested", "inerested", "will visit", "visiting", "admission", "assessment", "positive"]`
  - `NEGATIVE`: `["not interested", "dead lead", "dead", "wrong number", "cancelled", "negative"]`
  - `INVALID_DUPLICATE`: `["duplicate", "invalid", "repeat"]`
  - `PENDING`: Default when follow-up notes exist without a clear Yes/No keyword.
- **Pending Sub-Status Classifier:**
  - `MSG_NO_REPLY`: `["no feedback from whatsapp", "sent a reminder", "welcome message", "poster sent", "email sent", "message sent"]`
  - `CALLED_NO_ANSWER`: `["no answer", "didn't answer", "not answering", "busy", "phone closed", "not connecting"]`
  - `ANSWERED_NO_DECISION`: `["answered", "calls back", "planning for next year", "scholarship", "doubt", "sen child"]`
  - `OTHER`: Fallback for all other `PENDING` leads.

## 4. Conflict Resolution & Two-Way Write-Back
1. **App Priority Rule:** If `leads.status_updated_by_app === true`, inbound Google Sheet sync will append any brand-new Sheet notes to `follow_up_notes` (deduplicated by text hash) **without** overwriting the `feedback_status` or `pending_substatus` set inside the web app.
2. **Optional Sheet Write-Back:** When `tenants.enable_sheet_writeback === true` and a counselor adds a note in the web UI, append `DD.MM.YYYY | <note_text> (<counselor_name>)` to the corresponding `Followup - 1/2/3` cell via Google Sheets API `spreadsheets.values.update`.
