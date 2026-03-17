/**
 * guardEvidence
 *
 * Strips known PII field names and truncates string values before the evidence
 * object is forwarded to any external LLM adapter. Call this on every evidence
 * payload at the skill boundary — before passing to system.transition().
 *
 * Blocked field names (case-insensitive):
 *   ssn, sin, dob, dateofbirth, passport, driverslicense, creditcard, ccn,
 *   accountnumber, routingnumber, iban, swift, pin, password, secret, token,
 *   email, phone, mobile, address, ip, ipaddress, geolocation, lat, lng,
 *   healthrecord, mrn, npi, diagnosis, medication
 *
 * All string values are capped at MAX_VALUE_LENGTH characters to prevent
 * context stuffing / prompt injection via large payloads.
 */

const BLOCKED_KEYS = new Set([
  "ssn", "sin", "dob", "dateofbirth", "passport", "driverslicense",
  "creditcard", "ccn", "accountnumber", "routingnumber", "iban", "swift",
  "pin", "password", "secret", "token", "email", "phone", "mobile",
  "address", "ip", "ipaddress", "geolocation", "lat", "lng",
  "healthrecord", "mrn", "npi", "diagnosis", "medication",
]);

const MAX_VALUE_LENGTH = 512;

/** Characters that look like LLM role/instruction prefixes. Stripped from string values. */
const INJECTION_PATTERN = /^(system|user|assistant|human|ai)\s*:/i;

export type EvidenceValue = string | number | boolean | null;
export type EvidenceRecord = Record<string, EvidenceValue>;

export function guardEvidence(evidence: EvidenceRecord): EvidenceRecord {
  const result: EvidenceRecord = {};

  for (const [key, value] of Object.entries(evidence)) {
    const normalizedKey = key.toLowerCase().replace(/[_\-\s]/g, "");

    // Drop blocked field names
    if (BLOCKED_KEYS.has(normalizedKey)) {
      continue;
    }

    // Sanitize string values
    if (typeof value === "string") {
      let cleaned = value.trim();

      // Strip prompt injection role prefixes
      cleaned = cleaned.replace(INJECTION_PATTERN, "").trimStart();

      // Cap length to prevent context stuffing
      if (cleaned.length > MAX_VALUE_LENGTH) {
        cleaned = cleaned.slice(0, MAX_VALUE_LENGTH) + " [truncated]";
      }

      result[key] = cleaned;
      continue;
    }

    result[key] = value;
  }

  return result;
}
