/**
 * phoneValidation.ts — shared phone number validation utility.
 *
 * Uses libphonenumber-js for proper country-aware validation and E.164
 * normalisation.  A single source of truth used by ProfileSettings,
 * FindBestMatches, and JobApplyPage.
 */

import {
  parsePhoneNumber,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

// ─── Timezone → country mapping ───────────────────────────────────────────────
// Only covers timezones that unambiguously map to a single country calling code.
// Ambiguous timezones (e.g. America/New_York covers US + CA) are not listed so
// we never block the user based on timezone alone when the mapping is unclear.

const TIMEZONE_TO_COUNTRY: Record<string, CountryCode> = {
  "Asia/Manila":         "PH",
  "Asia/Tokyo":          "JP",
  "Asia/Singapore":      "SG",
  "Asia/Kuala_Lumpur":   "MY",
  "Asia/Jakarta":        "ID",
  "Asia/Bangkok":        "TH",
  "Asia/Ho_Chi_Minh":    "VN",
  "Asia/Seoul":          "KR",
  "Asia/Shanghai":       "CN",
  "Asia/Taipei":         "TW",
  "Asia/Hong_Kong":      "HK",
  "Asia/Kolkata":        "IN",
  "Asia/Dhaka":          "BD",
  "Asia/Karachi":        "PK",
  "Asia/Riyadh":         "SA",
  "Asia/Dubai":          "AE",
  "Asia/Beirut":         "LB",
  "Australia/Sydney":    "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane":  "AU",
  "Pacific/Auckland":    "NZ",
  "Europe/London":       "GB",
  "Europe/Paris":        "FR",
  "Europe/Berlin":       "DE",
  "Europe/Rome":         "IT",
  "Europe/Madrid":       "ES",
  "Europe/Amsterdam":    "NL",
  "Europe/Brussels":     "BE",
  "Europe/Lisbon":       "PT",
  "Europe/Warsaw":       "PL",
  "Europe/Helsinki":     "FI",
  "Europe/Stockholm":    "SE",
  "Europe/Oslo":         "NO",
  "Europe/Copenhagen":   "DK",
  "Europe/Athens":       "GR",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos":        "NG",
  "Africa/Nairobi":      "KE",
  "Africa/Cairo":        "EG",
};

/** Return the country code that unambiguously corresponds to a timezone, or null. */
export function countryFromTimezone(timezone: string): CountryCode | null {
  return TIMEZONE_TO_COUNTRY[timezone] ?? null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface PhoneValidationResult {
  /** True when the number is structurally valid for the resolved country. */
  valid: boolean;
  /** E.164 formatted string (e.g. "+639123456789") or null if invalid. */
  e164: string | null;
  /** User-facing error message or null when valid. */
  error: string | null;
}

/**
 * Validate a phone number string.
 *
 * @param value   Raw input from the user (may include spaces, dashes, etc.)
 * @param country ISO 3166-1 alpha-2 country code hint used for local-format numbers.
 *                If omitted the number must include a calling code (+XX).
 */
export function validatePhone(
  value: string,
  country?: CountryCode | null,
): PhoneValidationResult {
  const raw = (value || "").trim();
  if (!raw) {
    return { valid: false, e164: null, error: "Phone number is required" };
  }

  try {
    // Try parsing with country hint first so local formats (09xxxxxxxxx) work.
    const parsed = parsePhoneNumber(raw, country ?? undefined);
    if (parsed && parsed.isValid()) {
      return { valid: true, e164: parsed.format("E.164"), error: null };
    }
    // If that fails, try without hint (international format like +63…)
    if (!country) {
      const intl = parsePhoneNumber(raw);
      if (intl?.isValid()) {
        return { valid: true, e164: intl.format("E.164"), error: null };
      }
    }
  } catch {
    // parse threw — fall through to format error below
  }

  // Diagnose a common mistake: too few / too many digits
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) {
    return { valid: false, e164: null, error: "This number appears to be too short." };
  }

  const countryLabel = country ? countryName(country) : "the selected country";
  return {
    valid: false,
    e164: null,
    error: `Please enter a valid ${countryLabel} phone number.`,
  };
}

/** Validate and return whether a phone/timezone pairing is consistent. */
export function validatePhoneTimezoneMatch(
  phone: string,
  timezone: string,
): { ok: boolean; message: string | null } {
  const expectedCountry = countryFromTimezone(timezone);
  if (!expectedCountry) return { ok: true, message: null }; // ambiguous — don't block

  const raw = (phone || "").trim();
  if (!raw) return { ok: true, message: null }; // empty — let the required check handle it

  try {
    // Parse with the expected country as hint
    const parsed = parsePhoneNumber(raw, expectedCountry);
    if (parsed?.isValid() && parsed.country === expectedCountry) {
      return { ok: true, message: null };
    }
    // Try parsing without hint to catch international format
    const intl = parsePhoneNumber(raw);
    if (intl?.isValid() && intl.country === expectedCountry) {
      return { ok: true, message: null };
    }
    // Parsed as a different country
    if (intl?.isValid() && intl.country !== expectedCountry) {
      return {
        ok: false,
        message: `Your selected timezone is ${tzLabel(timezone)}, but this phone number appears to use a different country code. Please use a ${countryName(expectedCountry)} number (+${intl.countryCallingCode} found).`,
      };
    }
  } catch {
    // parse error — don't block on timezone mismatch, let validatePhone handle format
  }

  return { ok: true, message: null };
}

/** Normalize a phone number to E.164 if possible, otherwise return raw value. */
export function normalizePhone(value: string, country?: CountryCode | null): string {
  const result = validatePhone(value, country);
  return result.e164 ?? value;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tzLabel(timezone: string): string {
  // e.g. "Asia/Manila" → "Philippines (Asia/Manila)"
  const country = TIMEZONE_TO_COUNTRY[timezone];
  return country ? `${countryName(country)} (${timezone})` : timezone;
}

const COUNTRY_NAMES: Partial<Record<CountryCode, string>> = {
  PH: "Philippine", SG: "Singapore", MY: "Malaysian", ID: "Indonesian",
  TH: "Thai", VN: "Vietnamese", JP: "Japanese", KR: "Korean",
  CN: "Chinese", TW: "Taiwanese", HK: "Hong Kong", IN: "Indian",
  BD: "Bangladeshi", PK: "Pakistani", SA: "Saudi", AE: "UAE",
  LB: "Lebanese", AU: "Australian", NZ: "New Zealand", GB: "UK",
  FR: "French", DE: "German", IT: "Italian", ES: "Spanish",
  NL: "Dutch", BE: "Belgian", PT: "Portuguese", PL: "Polish",
  FI: "Finnish", SE: "Swedish", NO: "Norwegian", DK: "Danish",
  GR: "Greek", ZA: "South African", NG: "Nigerian", KE: "Kenyan",
  EG: "Egyptian",
};

function countryName(code: CountryCode): string {
  return COUNTRY_NAMES[code] ?? code;
}
