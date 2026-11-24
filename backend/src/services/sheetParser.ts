import { FeedbackStatus, PendingSubstatus } from '../types/index.js';

export interface ParsedNote {
  noteText: string;
  stage: number;
  counselorTag?: string;
  notedAt: Date;
}

export interface KeywordRules {
  positive?: string[];
  negative?: string[];
  invalidDuplicate?: string[];
  msgNoReply?: string[];
  calledNoAnswer?: string[];
  answeredNoDecision?: string[];
}

export const DEFAULT_KEYWORD_RULES: Required<KeywordRules> = {
  positive: [
    'interested',
    'inerested',
    'will visit',
    'visiting',
    'visited',
    'admission',
    'assessment',
    'positive',
    'registered',
    'confirmed',
  ],
  negative: [
    'not interested',
    'dead lead',
    'dead',
    'wrong number',
    'cancelled',
    'canceled',
    'negative',
    'reject',
    'declined',
  ],
  invalidDuplicate: ['duplicate', 'invalid', 'repeat', 'test lead'],
  msgNoReply: [
    'no feedback from whatsapp',
    'sent a reminder',
    'welcome message',
    'poster sent',
    'email sent',
    'message sent',
    'whatsapp sent',
  ],
  calledNoAnswer: [
    'no answer',
    "didn't answer",
    'not answering',
    'busy',
    'phone closed',
    'not connecting',
    'switched off',
  ],
  answeredNoDecision: [
    'answered',
    'calls back',
    'planning for next year',
    'scholarship',
    'doubt',
    'sen child',
    'discuss with father',
    'thinking',
  ],
};

const DATE_REGEX = /(\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b)/;
const COUNSELOR_TAG_REGEX = /\(([^)]+)\)\s*$/;

/**
 * Parses a date string like DD.MM.YYYY, DD/MM/YYYY, or YYYY-MM-DD into a valid Date.
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(DATE_REGEX);
  if (!match) {
    const directDate = new Date(dateStr);
    return isNaN(directDate.getTime()) ? null : directDate;
  }

  const raw = match[1];
  const parts = raw.split(/[.\/-]/);

  if (parts.length === 3) {
    // Check if format is YYYY-MM-DD
    if (parts[0].length === 4) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return isNaN(d.getTime()) ? null : d;
    }
    // Assume DD.MM.YYYY or DD/MM/YY
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;

    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Parses a free-text follow-up cell (which may contain multiple entries separated by pipes or newlines).
 */
export function parseFollowUpCell(cellContent: string | null | undefined, stage: number): ParsedNote[] {
  if (!cellContent || !cellContent.toString().trim()) {
    return [];
  }

  const text = cellContent.toString().trim();
  // Split on pipe or newline if multiple dated notes are present
  const rawSegments = text.split(/\s*\|\s*|\n+/).filter((s) => s.trim().length > 0);

  const parsedNotes: ParsedNote[] = [];
  let currentNoteText = '';
  let currentNotedAt: Date = new Date();
  let currentCounselorTag: string | undefined = undefined;

  for (const segment of rawSegments) {
    const trimmed = segment.trim();
    const dateMatch = trimmed.match(DATE_REGEX);

    if (dateMatch) {
      // If we already accumulated a note, flush it
      if (currentNoteText) {
        parsedNotes.push({
          noteText: currentNoteText.trim(),
          stage,
          counselorTag: currentCounselorTag,
          notedAt: currentNotedAt,
        });
        currentNoteText = '';
        currentCounselorTag = undefined;
      }

      const parsedD = parseDate(dateMatch[1]);
      if (parsedD) currentNotedAt = parsedD;

      // The rest of this segment might have notes
      const withoutDate = trimmed.replace(dateMatch[0], '').trim();
      if (withoutDate) {
        currentNoteText = withoutDate;
      }
    } else {
      if (currentNoteText) {
        currentNoteText += ' | ' + trimmed;
      } else {
        currentNoteText = trimmed;
      }
    }

    // Check if current text ends with (counselor_name)
    const counselorMatch = currentNoteText.match(COUNSELOR_TAG_REGEX);
    if (counselorMatch) {
      currentCounselorTag = counselorMatch[1].trim();
    }
  }

  if (currentNoteText) {
    parsedNotes.push({
      noteText: currentNoteText.trim(),
      stage,
      counselorTag: currentCounselorTag,
      notedAt: currentNotedAt,
    });
  }

  // If no date was found in the text, return the whole cell as one note with current date
  if (parsedNotes.length === 0 && text) {
    const counselorMatch = text.match(COUNSELOR_TAG_REGEX);
    parsedNotes.push({
      noteText: text,
      stage,
      counselorTag: counselorMatch ? counselorMatch[1].trim() : undefined,
      notedAt: new Date(),
    });
  }

  return parsedNotes;
}

/**
 * Classifies feedback status and pending substatus from raw sheet feedback column and accumulated notes.
 */
export function classifyLeadStatus(
  sheetFeedback: string | null | undefined,
  allNotesText: string[],
  customRules?: KeywordRules | null
): { feedbackStatus: FeedbackStatus; pendingSubstatus: PendingSubstatus | null } {
  const rules = {
    positive: [...(customRules?.positive || []), ...DEFAULT_KEYWORD_RULES.positive],
    negative: [...(customRules?.negative || []), ...DEFAULT_KEYWORD_RULES.negative],
    invalidDuplicate: [...(customRules?.invalidDuplicate || []), ...DEFAULT_KEYWORD_RULES.invalidDuplicate],
    msgNoReply: [...(customRules?.msgNoReply || []), ...DEFAULT_KEYWORD_RULES.msgNoReply],
    calledNoAnswer: [...(customRules?.calledNoAnswer || []), ...DEFAULT_KEYWORD_RULES.calledNoAnswer],
    answeredNoDecision: [...(customRules?.answeredNoDecision || []), ...DEFAULT_KEYWORD_RULES.answeredNoDecision],
  };

  const combinedContent = [sheetFeedback || '', ...allNotesText].join(' ').toLowerCase();

  // If no feedback and zero notes -> NOT_CONTACTED
  if (!combinedContent.trim()) {
    return { feedbackStatus: 'NOT_CONTACTED', pendingSubstatus: null };
  }

  // 1. Check for INVALID_DUPLICATE
  for (const kw of rules.invalidDuplicate) {
    if (combinedContent.includes(kw.toLowerCase())) {
      return { feedbackStatus: 'INVALID_DUPLICATE', pendingSubstatus: null };
    }
  }

  // 2. Check for NEGATIVE (Negative check before positive to avoid "not interested" matching "interested")
  for (const kw of rules.negative) {
    if (combinedContent.includes(kw.toLowerCase())) {
      return { feedbackStatus: 'NEGATIVE', pendingSubstatus: null };
    }
  }

  // 3. Check for POSITIVE
  for (const kw of rules.positive) {
    if (combinedContent.includes(kw.toLowerCase())) {
      return { feedbackStatus: 'POSITIVE', pendingSubstatus: null };
    }
  }

  // 4. Default to PENDING if notes or feedback exist but no clear positive/negative
  // Now classify pending substatus
  let substatus: PendingSubstatus = 'OTHER';

  for (const kw of rules.calledNoAnswer) {
    if (combinedContent.includes(kw.toLowerCase())) {
      substatus = 'CALLED_NO_ANSWER';
      break;
    }
  }

  if (substatus === 'OTHER') {
    for (const kw of rules.msgNoReply) {
      if (combinedContent.includes(kw.toLowerCase())) {
        substatus = 'MSG_NO_REPLY';
        break;
      }
    }
  }

  if (substatus === 'OTHER') {
    for (const kw of rules.answeredNoDecision) {
      if (combinedContent.includes(kw.toLowerCase())) {
        substatus = 'ANSWERED_NO_DECISION';
        break;
      }
    }
  }

  return { feedbackStatus: 'PENDING', pendingSubstatus: substatus };
}
