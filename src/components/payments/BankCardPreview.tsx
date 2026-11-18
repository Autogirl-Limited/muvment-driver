"use client";

import { BadgeCheck } from "lucide-react";

import { BankLogo } from "./BankLogo";

/** "0123456789" → "0123 456 789", with dots for the digits still to come. */
const formatNumber = (value: string) => {
  const padded = value.padEnd(10, "•");

  return `${padded.slice(0, 4)} ${padded.slice(4, 7)} ${padded.slice(7, 10)}`;
};

/**
 * A card that fills in as the driver types: the bank, the account number and,
 * once it's looked up, the name on the account.
 */
export const BankCardPreview = ({
  bankName,
  bankCode,
  accountNumber,
  accountName,
  verified = false,
}: {
  bankName?: string;
  bankCode?: string;
  accountNumber: string;
  accountName?: string;
  verified?: boolean;
}) => (
  <div
    className="relative mb-6 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1E3A5F] via-[#2563EB] to-[#0A84FF] p-5 text-white shadow-[0_12px_28px_rgba(10,132,255,0.28)]"
    aria-label={`Bank card preview. ${bankName ?? "No bank chosen"}, ${accountNumber || "no account number yet"}`}
  >
    <span aria-hidden="true" className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10" />
    <span aria-hidden="true" className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/10" />

    <div className="relative flex items-center gap-3">
      <BankLogo bankName={bankName} bankCode={bankCode} size={40} />
      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{bankName ?? "Choose your bank"}</span>
      {verified && <BadgeCheck size={20} className="shrink-0" />}
    </div>

    <p className="relative mt-7 text-[24px] font-semibold tabular-nums tracking-[0.12em]">{formatNumber(accountNumber)}</p>

    <div className="relative mt-5">
      <p className="text-[11px] uppercase tracking-wider text-white/70">Account name</p>
      <p className="truncate text-[16px] font-semibold">{accountName ?? "—"}</p>
    </div>
  </div>
);
