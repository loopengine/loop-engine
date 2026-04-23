// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * redactPiiEvidence
 *
 * Strips known PII field names and truncates string values before the evidence
 * object is forwarded to any external LLM adapter. Call this on every evidence
 * payload at the skill boundary — before passing to engine.transition().
 *
 * Blocked field names (case-insensitive):
 *   ssn, sin, dob, dateofbirth, passport, driverslicense, creditcard, ccn,
 *   accountnumber, routingnumber, iban, swift, pin, password, secret, token,
 *   email, phone, mobile, address, ip, ipaddress, geolocation, lat, lng,
 *   healthrecord, mrn, npi, diagnosis, medication
 *
 * All string values are capped at MAX_VALUE_LENGTH characters to prevent
 * context stuffing / prompt injection via large payloads.
 *
 * Renamed from `guardEvidence` per PB-EX-03 Option A (MECHANICAL 8.16
 * extension, 2026-04-23): disambiguated from the generic
 * `guardEvidence` primitive in `@loop-engine/core`. Both functions
 * ship; this one is the opinionated PII-blocklist helper, and the
 * core one is the caller-configurable generic redaction primitive
 * that backs `ToolAdapter.guardEvidence`.
 */

import type { EvidenceRecord } from "@loop-engine/core";

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

export function redactPiiEvidence(evidence: EvidenceRecord): EvidenceRecord {
  const result: EvidenceRecord = {};

  for (const [key, value] of Object.entries(evidence)) {
    const normalizedKey = key.toLowerCase().replace(/[_\-\s]/g, "");

    if (BLOCKED_KEYS.has(normalizedKey)) {
      continue;
    }

    if (typeof value === "string") {
      let cleaned = value.trim();

      cleaned = cleaned.replace(INJECTION_PATTERN, "").trimStart();

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
