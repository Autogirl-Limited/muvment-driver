import {
  AsYouType,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";

import { COUNTRY_BY_ISO } from "@/lib/data/countries";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "NG";

/**
 * What a phone field holds: the country, and the number as the person sees
 * it, in that country's own format and without the calling code.
 * `text` starts with "+" only while someone is typing an international
 * number whose country isn't known yet.
 */
export interface PhoneValue {
  country: CountryCode;
  text: string;
}

export const emptyPhone = (country: CountryCode = DEFAULT_PHONE_COUNTRY): PhoneValue => ({
  country,
  text: "",
});

const digitsOf = (value: string) => value.replace(/\D/g, "");

const parse = (value: PhoneValue): PhoneNumber | undefined =>
  value.text.startsWith("+")
    ? parsePhoneNumberFromString(value.text)
    : parsePhoneNumberFromString(value.text, value.country);

/**
 * Formats national digits the way that country writes them. A complete,
 * valid number gets the country's standard format (Nigeria: 0801 234 5678,
 * whether or not the 0 was typed); a partial one is formatted as typed.
 */
const formatNational = (digits: string, country: CountryCode) => {
  if (!digits) return "";

  const parsed = parsePhoneNumberFromString(digits, country);
  if (parsed?.isValid() && parsed.country === country) {
    return parsed.formatNational();
  }

  return new AsYouType(country).input(digits);
};

const fromParsed = (parsed: PhoneNumber, fallback: CountryCode): PhoneValue => ({
  country: parsed.country ?? fallback,
  text: parsed.formatNational(),
});

/**
 * Reads an international number (digits after the "+"). Returns null until
 * there are enough digits to tell which country it belongs to.
 */
const fromInternational = (digits: string, fallback: CountryCode): PhoneValue | null => {
  const parsed = parsePhoneNumberFromString(`+${digits}`);

  if (parsed?.isValid()) {
    return fromParsed(parsed, fallback);
  }

  const formatter = new AsYouType();
  formatter.input(`+${digits}`);
  const country = formatter.getCountry();
  const national = formatter.getNumber()?.nationalNumber;

  return country && national
    ? { country, text: formatNational(national, country) }
    : null;
};

/**
 * Turns whatever was typed or pasted into a PhoneValue. An international
 * number (+234…, 00234…, or 234… pasted without the plus) switches the
 * country to match and drops the calling code from what's shown.
 */
export const interpretPhoneInput = (raw: string, previous: PhoneValue): PhoneValue => {
  const trimmed = raw.trim();
  let digits = digitsOf(trimmed);

  // Backspace over a space or bracket leaves the digits unchanged; treat it
  // as deleting the digit before it, or the formatting puts it straight back.
  if (
    digits === digitsOf(previous.text) &&
    trimmed.length < previous.text.length &&
    !previous.text.startsWith("+")
  ) {
    digits = digits.slice(0, -1);
  }

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const international = trimmed.startsWith("+") ? digits : digits.slice(2);
    return (
      fromInternational(international, previous.country) ?? {
        country: previous.country,
        text: international ? `+${international}` : trimmed.startsWith("+") ? "+" : "",
      }
    );
  }

  // A calling code without the plus, e.g. 2348012345678 pasted from a
  // spreadsheet. The parser already recognises the current country's own
  // code; other countries' codes only count if the digits don't already
  // make sense as a local number.
  const asLocal = parsePhoneNumberFromString(digits, previous.country);
  if (asLocal?.isValid()) {
    return fromParsed(asLocal, previous.country);
  }
  if (digits.length > 8) {
    const asInternational = parsePhoneNumberFromString(`+${digits}`);
    if (asInternational?.isValid()) {
      return fromParsed(asInternational, previous.country);
    }
  }

  return { country: previous.country, text: formatNational(digits, previous.country) };
};

/** Picks a new country and re-formats the digits already typed for it. */
export const changePhoneCountry = (value: PhoneValue, country: CountryCode): PhoneValue =>
  value.text.startsWith("+")
    ? { country, text: value.text }
    : { country, text: formatNational(digitsOf(value.text), country) };

/** The number in international E.164 form, e.g. "+2348012345678". */
export const toE164 = (value: PhoneValue): string | undefined => {
  const parsed = parse(value);
  return parsed?.isValid() ? parsed.number : undefined;
};

export const isPhoneEmpty = (value: PhoneValue) => digitsOf(value.text).length === 0;

export const isValidPhone = (value: PhoneValue) => Boolean(toE164(value));

export const countryName = (country: CountryCode) =>
  COUNTRY_BY_ISO.get(country)?.name ?? country;

/** A sample mobile number in national format, for the field's hint. */
export const examplePhone = (country: CountryCode) =>
  getExampleNumber(country, examples)?.formatNational() ?? "";
