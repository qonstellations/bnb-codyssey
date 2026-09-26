// Strips identifying info from free-text answers before upload — participants never
// give name/email in this app, but a stray paste into a text-response trial shouldn't leak one.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g
const LONG_DIGITS_RE = /\d{6,}/g

export function scrubText(text) {
  if (typeof text !== 'string') return text
  return text
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(PHONE_RE, '[redacted-number]')
    .replace(LONG_DIGITS_RE, '[redacted-digits]')
}
