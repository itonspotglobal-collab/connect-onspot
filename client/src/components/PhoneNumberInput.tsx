/**
 * PhoneNumberInput — shared phone input with inline libphonenumber-js validation.
 *
 * Props:
 *   value        controlled value (raw string from form state)
 *   onChange     called with the new raw string on every keystroke
 *   country      ISO 3166-1 alpha-2 hint (e.g. "PH") for local-format parsing
 *   timezone     if supplied, cross-checks phone country against timezone
 *   required     whether an empty value is an error
 *   disabled
 *   placeholder
 *
 * Validation fires on blur and on submit (parent can call validate() via ref,
 * or simply check the returned isValid from onChange metadata).
 */

import { useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  validatePhone,
  validatePhoneTimezoneMatch,
  type PhoneValidationResult,
} from "@/lib/phoneValidation";
import type { CountryCode } from "libphonenumber-js";

interface PhoneNumberInputProps {
  /** Current raw string value (controlled). */
  value: string;
  /** Called with new raw value on every change. */
  onChange: (value: string) => void;
  /** ISO 3166-1 alpha-2 country code for local-format parsing (e.g. "PH"). */
  country?: CountryCode | null;
  /** Timezone string — if set, fires a country-consistency check on blur. */
  timezone?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  /** Additional class for the wrapper div. */
  className?: string;
  /** External error override (e.g. from form submit). Cleared on next change. */
  externalError?: string | null;
  id?: string;
}

export function PhoneNumberInput({
  value,
  onChange,
  country,
  timezone,
  required = false,
  disabled = false,
  placeholder = "+63 912 345 6789",
  label = "Phone Number",
  className = "",
  externalError,
  id: idProp,
}: PhoneNumberInputProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;

  const [touchedError, setTouchedError] = useState<string | null>(null);
  const [tzError, setTzError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    // Clear inline errors optimistically while typing
    if (touchedError) setTouchedError(null);
    if (tzError) setTzError(null);
  };

  const handleBlur = () => {
    const raw = (value || "").trim();

    if (!raw) {
      if (required) setTouchedError("Phone number is required");
      return;
    }

    // Only validate when there are enough digits to be meaningful (≥ 7)
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 4) return; // still typing country code — don't annoy

    const result: PhoneValidationResult = validatePhone(raw, country);
    if (!result.valid) {
      setTouchedError(result.error);
    } else {
      setTouchedError(null);
    }

    // Timezone ↔ country consistency (only when timezone supplied)
    if (timezone && result.valid) {
      const tzCheck = validatePhoneTimezoneMatch(raw, timezone);
      setTzError(tzCheck.ok ? null : tzCheck.message);
    }
  };

  const displayError = externalError || touchedError || tzError;
  const isError = !!displayError;

  return (
    <div className={className}>
      <Label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Input
        id={inputId}
        type="tel"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="tel"
        className={isError ? "border-red-400 focus-visible:ring-red-400" : ""}
        aria-invalid={isError}
        aria-describedby={isError ? `${inputId}-error` : undefined}
      />
      {isError && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-red-500">
          {displayError}
        </p>
      )}
    </div>
  );
}
