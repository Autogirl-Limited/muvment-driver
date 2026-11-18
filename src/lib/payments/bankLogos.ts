/**
 * Bank logos bundled in /public/banks (copied from the mobile app), matched
 * the same way the mobile app and admin app do: by a phrase in the bank's
 * name first, then by its CBN / NIP code. Order matters: "first city" before
 * "first". The backend also serves logos (`GET /banks/{code}/logo`); these
 * bundled ones show at once and cover banks it has none for.
 */
const LOGO_FILES = {
  gtbank: "gtbank.webp",
  access: "access.webp",
  citibank: "citibank.webp",
  ecobank: "ecobank.webp",
  fcmb: "fcmb.webp",
  fidelity: "fidelity.webp",
  firstBank: "first-bank.webp",
  globus: "globus.webp",
  keystone: "keystone.webp",
  kuda: "kuda.webp",
  opay: "opay.webp",
  palmpay: "palmpay.webp",
  parallex: "parallex.webp",
  polaris: "polaris.webp",
  providus: "providus.webp",
  stanbic: "stanbic-ibtc.webp",
  standardChartered: "standard-chartered.webp",
  sterling: "sterling.webp",
  uba: "uba.webp",
  unionBank: "union-bank.webp",
  unity: "unity.webp",
  vfd: "vfd.webp",
  wema: "wema.png",
  zenith: "zenith.webp",
} as const;

export type BankLogoKey = keyof typeof LOGO_FILES;

const LOGO_BY_NAME: [RegExp, BankLogoKey][] = [
  [/\bgt ?bank|guaranty/, "gtbank"],
  [/\baccess\b/, "access"],
  [/\bciti/, "citibank"],
  [/\becobank/, "ecobank"],
  [/\bfcmb|first city monument/, "fcmb"],
  [/\bfidelity/, "fidelity"],
  [/\bfirst ?bank/, "firstBank"],
  [/\bglobus/, "globus"],
  [/\bkeystone/, "keystone"],
  [/\bkuda/, "kuda"],
  [/\bopay|paycom/, "opay"],
  [/\bpalm ?pay/, "palmpay"],
  [/\bparallex/, "parallex"],
  [/\bpolaris/, "polaris"],
  [/\bprovidus/, "providus"],
  [/\bstanbic/, "stanbic"],
  [/\bstandard chartered/, "standardChartered"],
  [/\bsterling/, "sterling"],
  [/\buba\b|united bank for africa/, "uba"],
  [/\bunion bank/, "unionBank"],
  [/\bunity/, "unity"],
  [/\bvfd/, "vfd"],
  [/\bwema|alat/, "wema"],
  [/\bzenith/, "zenith"],
];

const LOGO_BY_CODE: Record<string, BankLogoKey> = {
  "058": "gtbank",
  "044": "access",
  "063": "access",
  "023": "citibank",
  "050": "ecobank",
  "214": "fcmb",
  "070": "fidelity",
  "011": "firstBank",
  "00103": "globus",
  "082": "keystone",
  "50211": "kuda",
  "090267": "kuda",
  "305": "opay",
  "100004": "opay",
  "999992": "opay",
  "100033": "palmpay",
  "999991": "palmpay",
  "104": "parallex",
  "076": "polaris",
  "101": "providus",
  "000023": "providus",
  "221": "stanbic",
  "068": "standardChartered",
  "232": "sterling",
  "033": "uba",
  "032": "unionBank",
  "215": "unity",
  "566": "vfd",
  "090110": "vfd",
  "035": "wema",
  "057": "zenith",
};

export const bankLogoKey = (bankName?: string | null, bankCode?: string | null): BankLogoKey | undefined => {
  const name = (bankName ?? "").toLowerCase();
  const byName = LOGO_BY_NAME.find(([pattern]) => pattern.test(name));

  if (byName) return byName[1];

  return bankCode ? LOGO_BY_CODE[bankCode.trim()] : undefined;
};

/** The bundled logo's address, if there is one for this bank. */
export const bankLogoPath = (bankName?: string | null, bankCode?: string | null) => {
  const key = bankLogoKey(bankName, bankCode);

  return key ? `/banks/${LOGO_FILES[key]}` : undefined;
};

export const bankLogoPathByKey = (key: BankLogoKey) => `/banks/${LOGO_FILES[key]}`;

/** The five banks that orbit the bank on the locked Payments page. */
export const ORBIT_BANKS: { key: BankLogoKey; name: string; code: string }[] = [
  { key: "gtbank", name: "GTBank", code: "058" },
  { key: "access", name: "Access Bank", code: "044" },
  { key: "zenith", name: "Zenith Bank", code: "057" },
  { key: "opay", name: "OPay", code: "999992" },
  { key: "kuda", name: "Kuda", code: "50211" },
];

/** Shortcuts on the Add Bank Details page: the banks most drivers use. */
export const POPULAR_BANK_KEYS: BankLogoKey[] = [
  "opay",
  "gtbank",
  "access",
  "zenith",
  "uba",
  "firstBank",
  "kuda",
  "palmpay",
  "fidelity",
  "wema",
];

/** Short names for the shortcut chips, where the full name is too long to fit. */
export const POPULAR_BANK_LABELS: Partial<Record<BankLogoKey, string>> = {
  opay: "OPay",
  gtbank: "GTBank",
  access: "Access",
  zenith: "Zenith",
  uba: "UBA",
  firstBank: "FirstBank",
  kuda: "Kuda",
  palmpay: "PalmPay",
  fidelity: "Fidelity",
  wema: "Wema",
};
