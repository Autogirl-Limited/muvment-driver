"use client";

import { useRouter } from "next/navigation";
import { Landmark, Lock, ShieldCheck, UserCheck, Wallet } from "lucide-react";

import { BankLogo } from "@/components/payments/BankLogo";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useDriverPaymentSummary } from "@/lib/api/hooks/useDriverPayments";
import { ORBIT_BANKS } from "@/lib/payments/bankLogos";

/**
 * Whether Payments may open. "checking" until the summary says whether a bank
 * account is on file: the page is never drawn on a guess, so a driver without
 * one never sees it, not even for a moment, before the lock.
 */
export type PaymentsAccess = "checking" | "locked" | "open" | "failed";

export const usePaymentsAccess = () => {
  const summaryQuery = useDriverPaymentSummary();
  const summary = summaryQuery.data?.data;
  let access: PaymentsAccess;

  if (summary) access = summary.hasBankAccount ? "open" : "locked";
  // Never loaded and can't load now (an error, or waiting for a signal): say so rather than spin forever.
  else if (summaryQuery.isError || summaryQuery.fetchStatus === "paused") access = "failed";
  else access = "checking";

  return { access, summaryQuery };
};

/** In place of Payments while we find out whether the driver has a bank account. */
export const PaymentsChecking = () => (
  <div
    role="progressbar"
    aria-label="Checking your payment account"
    className="flex min-h-[320px] flex-1 items-center justify-center text-accent"
  >
    <Spinner size={26} />
  </div>
);

/** We couldn't tell whether there's a bank account on file, so Payments stays closed until we can. */
export const PaymentsCheckFailed = ({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) => (
  <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center px-6 text-center">
    <p className="text-headline text-text">Couldn&apos;t open Payments</p>
    <p className="text-callout mt-1.5 mb-5 text-text-3">
      We need to check your bank details first. Check your connection and try again.
    </p>
    <div className="w-full max-w-[220px]">
      <Button variant="outline" onClick={onRetry} loading={retrying}>
        Try again
      </Button>
    </div>
  </div>
);

const ORBIT_RADIUS = 104;

/** A bank planet with the banks drivers use orbiting it on a Saturn-style ring. */
const BankOrbit = () => (
  <div className="relative mx-auto flex h-[260px] w-[260px] items-center justify-center" aria-hidden>
    <div className="absolute h-[208px] w-[208px] rounded-full border border-dashed border-border-strong" />
    <div className="orbit-spin absolute inset-0" style={{ animation: "orbit-spin 28s linear infinite" }}>
      {ORBIT_BANKS.map((bank, index) => {
        const angle = (360 / ORBIT_BANKS.length) * index;

        return (
          <span
            key={bank.key}
            className="absolute left-1/2 top-1/2 -ml-[22px] -mt-[22px]"
            style={{ transform: `rotate(${angle}deg) translateY(-${ORBIT_RADIUS}px) rotate(-${angle}deg)` }}
          >
            <span className="orbit-counter block shadow-float" style={{ animation: "orbit-counter 28s linear infinite", borderRadius: 11 }}>
              <BankLogo bankName={bank.name} bankCode={bank.code} size={44} />
            </span>
          </span>
        );
      })}
    </div>
    <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-accent to-navy-mid text-white shadow-float">
      <Landmark size={40} />
      <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-warning text-white ring-4 ring-bg">
        <Lock size={15} />
      </span>
    </span>
  </div>
);

const FEATURES = [
  { body: "We check the account name matches yours before saving it.", icon: UserCheck, tint: "#0A84FF", title: "Verified in Your Name" },
  { body: "Approved allowances, overtime and airport tickets land in this account.", icon: Wallet, tint: "#34C759", title: "Paid Straight to You" },
  { body: "A one-time code sent to you confirms every change.", icon: ShieldCheck, tint: "#5E5CE6", title: "Protected by a Code" },
];

/**
 * Payments stays locked until the driver adds a bank account: a bank planet
 * with the banks drivers use orbiting it, what adding one gets them, and one
 * clear action.
 */
export const PaymentsLocked = () => {
  const router = useRouter();

  return (
    <div className="anim-fade-in flex flex-col items-center px-5 pb-8 pt-1">
      <BankOrbit />

      <span className="mt-1 inline-flex h-[26px] items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-[12px] font-semibold tracking-wide text-warning-text">
        <Lock size={11} strokeWidth={3} />
        PAYMENTS LOCKED
      </span>

      <h2 className="text-title-1 mt-3.5 text-center text-text">
        Add Your Bank
        <br />
        to Get Paid
      </h2>
      <p className="text-body mt-2.5 max-w-[340px] text-center text-text-2">
        Your payments go straight into your bank account. Add it once to unlock Payments and start claiming.
      </p>

      <div className="card mt-6 w-full py-1.5">
        {FEATURES.map(({ body, icon: Icon, tint, title }, index) => (
          <div key={title} className={`flex items-center gap-3.5 px-4 py-3.5 ${index > 0 ? "border-t border-separator" : ""}`}>
            <span
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] text-white"
              style={{ backgroundColor: tint }}
            >
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-body block font-semibold text-text">{title}</span>
              <span className="text-footnote mt-0.5 block text-text-3">{body}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 w-full">
        <Button onClick={() => router.push("/payment-account")}>Add Bank Details</Button>
        <p className="text-footnote mt-2.5 text-center text-text-4">
          Takes about a minute. You&apos;ll need your account number.
        </p>
      </div>
    </div>
  );
};
