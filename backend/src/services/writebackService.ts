import { query } from '../db/index.js';
import { defaultSheetsService } from './googleSheetsService.js';

function colIndexToA1(index: number): string {
  let col = '';
  let temp = index;
  while (temp >= 0) {
    col = String.fromCharCode((temp % 26) + 65) + col;
    temp = Math.floor(temp / 26) - 1;
  }
  return col;
}

export interface IWriteBackParams {
  tenantId: string;
  leadId: string;
  stage: number;
  noteText: string;
  counselorName?: string;
}

/**
 * Two-way writeback: Appends newly logged counselor notes to the corresponding
 * Followup - 1/2/3 column in the connected Google Sheet if enable_sheet_writeback is true.
 */
export async function writeBackNoteToSheet(params: IWriteBackParams): Promise<boolean> {
  const { tenantId, leadId, stage, noteText, counselorName } = params;
  try {
    const tenantRes = await query(
      `SELECT enable_sheet_writeback, google_sheet_id, timezone FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (!tenantRes.rows.length) return false;
    const { enable_sheet_writeback, google_sheet_id, timezone } = tenantRes.rows[0];
    if (!enable_sheet_writeback || !google_sheet_id) {
      return false;
    }

    const leadRes = await query(
      `SELECT l.sheet_row_number, c.tab_name
       FROM leads l
       JOIN campaigns c ON l.campaign_id = c.id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [leadId, tenantId]
    );

    if (!leadRes.rows.length) return false;
    const { sheet_row_number, tab_name } = leadRes.rows[0];
    if (!sheet_row_number || !tab_name) return false;

    // Get header row from tab to dynamically locate the stage column
    const headerRows = await defaultSheetsService.getSheetRange?.(google_sheet_id, `'${tab_name}'!A1:Z1`) || [];
    if (!headerRows.length || !headerRows[0].length) return false;
    const headers = headerRows[0];

    // Find column matching stage, e.g. "Followup - 1", "Followup 1", "Follow-up 1"
    let colIndex = -1;
    const stagePattern = new RegExp(`follow[-_\\s]*up[-_\\s]*${stage}`, 'i');
    for (let i = 0; i < headers.length; i++) {
      if (stagePattern.test(headers[i])) {
        colIndex = i;
        break;
      }
    }

    // Fallback: search for any column with "follow" in order of stage
    if (colIndex === -1) {
      const followupHeaders = headers
        .map((h, idx) => ({ h, idx }))
        .filter((item) => /follow/i.test(item.h));
      if (followupHeaders[stage - 1]) {
        colIndex = followupHeaders[stage - 1].idx;
      }
    }

    if (colIndex === -1) {
      console.warn(`[WriteBack] Could not find sheet column for Followup stage ${stage} in tab ${tab_name}`);
      return false;
    }

    const colLetter = colIndexToA1(colIndex);
    const cellRange = `'${tab_name}'!${colLetter}${sheet_row_number}`;

    // Read current cell value to append without deleting previous entries
    const cellData = await defaultSheetsService.getSheetRange?.(google_sheet_id, cellRange) || [];
    const existingVal = (cellData[0] && cellData[0][0]) ? cellData[0][0].trim() : '';

    // Date formatting (DD.MM.YYYY)
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB', {
      timeZone: timezone || 'Asia/Riyadh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '.');

    const author = counselorName ? counselorName.trim() : 'Counselor';
    const formattedNote = `${dateFormatted} | ${noteText.trim()} (${author})`;
    const finalVal = existingVal ? `${existingVal} | ${formattedNote}` : formattedNote;

    if (defaultSheetsService.updateSheetCell) {
      await defaultSheetsService.updateSheetCell(google_sheet_id, cellRange, finalVal);
      console.log(`[WriteBack] Successfully appended note to ${cellRange}`);
      return true;
    }

    return false;
  } catch (err) {
    console.warn('[WriteBack] Sheet write-back failed:', err);
    return false;
  }
}

