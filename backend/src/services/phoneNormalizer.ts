/**
 * Normalization & formatting utility for lead phone numbers.
 * Standardizes international and local Saudi numbers so WhatsApp direct links work reliably.
 */
export function normalizePhone(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;

  // Remove common prefix labels like "p:", "tel:", etc.
  let cleaned = rawPhone.toString().trim().replace(/^(p|tel|phone|contact)\s*:\s*/i, '');

  // Strip spaces, dashes, parentheses, dots
  cleaned = cleaned.replace(/[\s\-\(\)\.]/g, '');

  // If starts with +, strip +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // If starts with 00 (international prefix), strip 00
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }

  // Handle Saudi Arabia numbers specifically (starts with 05 or 5)
  // Local 05xxxxxxxx (10 digits) -> 9665xxxxxxxx (12 digits)
  if (/^05\d{8}$/.test(cleaned)) {
    return '966' + cleaned.slice(1);
  }

  // Local 5xxxxxxxx (9 digits) -> 9665xxxxxxxx
  if (/^5\d{8}$/.test(cleaned)) {
    return '966' + cleaned;
  }

  // Already prefixed Saudi number (9665xxxxxxxx)
  if (/^9665\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Only keep digits
  const onlyDigits = cleaned.replace(/\D/g, '');
  if (onlyDigits.length < 7) {
    return null; // Too short to be a valid phone number
  }

  return onlyDigits;
}

/**
 * Builds a direct WhatsApp chat URL for a normalized phone number.
 */
export function buildWhatsAppLink(phoneNormalized: string | null | undefined, text?: string): string | null {
  if (!phoneNormalized) return null;
  const baseUrl = `https://wa.me/${phoneNormalized}`;
  if (text) {
    return `${baseUrl}?text=${encodeURIComponent(text)}`;
  }
  return baseUrl;
}
