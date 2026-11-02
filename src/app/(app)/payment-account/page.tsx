"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, ChevronDown, Landmark, Mail, Search, Smartphone, X, XCircle } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { OTPInput } from "@/components/ui/OTPInput";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useBankAccount,
  useBanks,
  useRequestBankOtp,
  useResolveBankAccount,
  useSaveBankAccount,
} from "@/lib/api/hooks/useBankAccount";
import type { Bank, DriverBankAccount, OtpChannel } from "@/lib/api/types";
import { formatUtcDate } from "@/lib/utils/lagosTime";
import { useToast } from "@/providers/ToastProvider";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

type Step = "view" | "details" | "otp";

const AccountCard = ({ account }: { account: DriverBankAccount }) => (
  <div className="card p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Landmark size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-text">{account.bankName}</p>
        <p className="text-callout tabular-nums text-text-2">{account.accountNumberMasked}</p>
        <p className="text-footnote mt-0.5 text-text-3">{account.accountName}</p>
      </div>
      {account.verified && (
        <Pill tone="success" className="shrink-0">
          <BadgeCheck size={12} className="mr-1" /> Verified
        </Pill>
      )}
    </div>
    {account.updatedAt && <p className="text-footnote mt-3 text-text-4">Updated {formatUtcDate(account.updatedAt)}</p>}
  </div>
);

const BankPickerSheet = ({
  open,
  onClose,
  onSelect,
  selectedCode,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (bank: Bank) => void;
  selectedCode?: string;
}) => {
  const banksQuery = useBanks(open);
  const [search, setSearch] = useState("");
  const banks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = banksQuery.data?.data ?? [];
    return query ? list.filter((bank) => bank.name.toLowerCase().includes(query)) : list;
  }, [banksQuery.data, search]);

  return (
    <Sheet open={open} onClose={onClose} title="Choose your bank">
      <div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
        <Search size={17} className="shrink-0 text-text-4" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search banks"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-4"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="pressable-soft p-1 text-text-4" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="inset-group max-h-[52dvh] overflow-y-auto [&>*+*]:border-t [&>*+*]:border-separator">
        {banksQuery.isLoading ? (
          <div className="flex justify-center py-8 text-accent">
            <Spinner />
          </div>
        ) : banksQuery.isError ? (
          <p className="text-callout px-4 py-4 text-danger">{getApiErrorMessage(banksQuery.error) ?? "Couldn't load banks."}</p>
        ) : banks.length === 0 ? (
          <p className="text-callout px-4 py-4 text-text-3">No bank matches &ldquo;{search}&rdquo;.</p>
        ) : (
          banks.map((bank) => (
            <button
              key={bank.code}
              type="button"
              onClick={() => onSelect(bank)}
              className="pressable-row flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-body text-text">{bank.name}</span>
              {bank.code === selectedCode && <Check size={18} className="text-accent" />}
            </button>
          ))
        )}
      </div>
    </Sheet>
  );
};

export default function PaymentAccountPage() {
  const toast = useToast();
  const accountQuery = useBankAccount();
  const overview = accountQuery.data?.data;
  const [step, setStep] = useState<Step>("view");
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [isBankPickerOpen, setBankPickerOpen] = useState(false);
  const [channel, setChannel] = useState<OtpChannel>("PHONE");
  const [otp, setOtp] = useState("");
  const [otpDestination, setOtpDestination] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const resolveQuery = useResolveBankAccount({ accountNumber, bankCode: bank?.code });
  const requestOtp = useRequestBankOtp();
  const saveAccount = useSaveBankAccount();
  const resolved = resolveQuery.data?.data;
  const driverFullName = overview ? `${overview.driverName.firstName} ${overview.driverName.lastName}`.trim() : "";
  const canContinue = Boolean(bank && /^\d{10}$/.test(accountNumber) && resolved?.matches);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timeout = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [resendIn]);

  const resetForm = () => {
    setBank(null);
    setAccountNumber("");
    setOtp("");
    setOtpDestination(null);
    setResendIn(0);
  };

  const sendOtp = async () => {
    try {
      const response = await requestOtp.mutateAsync(channel);
      setOtpDestination(response.data.destinationMasked);
      setResendIn(RESEND_SECONDS);
      setOtp("");
    } catch (error) {
      toast.error("Couldn't send the code", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const save = async () => {
    if (!bank || otp.length !== OTP_LENGTH) return;
    try {
      await saveAccount.mutateAsync({ bankCode: bank.code, bankName: bank.name, accountNumber, otp });
      toast.success("Payment account saved", "Future payments go to this account.");
      resetForm();
      setStep("view");
    } catch (error) {
      toast.error("Couldn't save the account", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const back =
    step === "view" ? (
      <BackButton href="/settings" label="Settings" />
    ) : (
      <BackButton onClick={() => setStep(step === "otp" ? "details" : "view")} />
    );

  if (accountQuery.isLoading) {
    return (
      <Screen>
        <NavBar left={back} title="Payment account" />
        <EmptyState loading title="Loading" description="Fetching your payment account." />
      </Screen>
    );
  }

  if (accountQuery.isError || !overview) {
    return (
      <Screen>
        <NavBar left={back} title="Payment account" />
        <EmptyState
          title="Unable to load your account"
          description={getApiErrorMessage(accountQuery.error) ?? "Please check your connection and try again."}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar left={back} title="Payment account" />

      <div className="anim-fade-in px-5 pt-2 pb-10">
        {step === "view" && (
          <>
            <SectionHeader>Your payments go to</SectionHeader>
            {overview.current ? (
              <AccountCard account={overview.current} />
            ) : (
              <div className="card p-5 text-center">
                <Landmark size={28} className="mx-auto text-text-4" />
                <p className="text-headline mt-3 text-text">No payment account yet</p>
                <p className="text-footnote mt-1 text-text-3">Add the bank account in your name that your allowances are paid into.</p>
              </div>
            )}
            <div className="mt-4">
              <Button
                onClick={() => {
                  resetForm();
                  setStep("details");
                }}
              >
                {overview.current ? "Change account" : "Add account"}
              </Button>
            </div>
            <p className="text-footnote mt-3 text-text-4">
              The account name must match your name: {driverFullName}. A payment already being sent keeps the old account.
            </p>

            {overview.history.length > 0 && (
              <section className="mt-8">
                <SectionHeader>Previous accounts</SectionHeader>
                <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
                  {overview.history.map((account, index) => (
                    <div key={`${account.accountNumberMasked}-${index}`} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-body font-medium text-text">{account.bankName}</p>
                        <Pill tone="neutral">Replaced</Pill>
                      </div>
                      <p className="text-footnote text-text-3">
                        {account.accountNumberMasked} · {account.accountName}
                      </p>
                      {account.replacedAt && <p className="text-footnote text-text-4">Replaced {formatUtcDate(account.replacedAt)}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {step === "details" && (
          <>
            <p className="text-callout mb-2 font-medium text-text">Bank</p>
            <button
              type="button"
              onClick={() => setBankPickerOpen(true)}
              className="pressable mb-5 flex h-12 w-full items-center justify-between rounded-xl border border-border-strong bg-surface px-4 text-left"
            >
              <span className={`text-[16px] ${bank ? "text-text" : "text-text-4"}`}>{bank?.name ?? "Choose your bank"}</span>
              <ChevronDown size={18} className="text-text-4" />
            </button>

            <TextField
              label="Account number"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="10-digit account number"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
              hint={accountNumber.length > 0 && accountNumber.length < 10 ? `${10 - accountNumber.length} more digits` : undefined}
            />

            {bank && accountNumber.length === 10 && (
              <div className="mb-5">
                {resolveQuery.isFetching ? (
                  <p className="text-callout flex items-center gap-2 text-text-3">
                    <Spinner size={16} className="text-accent" /> Looking up the account name...
                  </p>
                ) : resolveQuery.isError ? (
                  <p className="text-callout text-danger">
                    {getApiErrorMessage(resolveQuery.error) ?? "Couldn't find this account. Check the number and bank."}
                  </p>
                ) : resolved ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 ${
                      resolved.matches ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft"
                    }`}
                  >
                    <p className="text-caption text-text-3">Account name</p>
                    <p className="text-body font-semibold text-text">{resolved.accountName}</p>
                    {resolved.matches ? (
                      <p className="text-footnote mt-1 flex items-center gap-1.5 text-success-text">
                        <BadgeCheck size={14} /> Matches your name
                      </p>
                    ) : (
                      <p className="text-footnote mt-1 flex items-start gap-1.5 text-danger-text">
                        <XCircle size={14} className="mt-[2px] shrink-0" />
                        The account name must match your name: {driverFullName}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <Button disabled={!canContinue} onClick={() => setStep("otp")}>
              Continue
            </Button>
            <p className="text-footnote mt-3 text-text-4">
              If your name has changed, ask the Driver Manager to correct it before adding this account.
            </p>
          </>
        )}

        {step === "otp" && bank && (
          <>
            <div className="card mb-6 p-4">
              <p className="text-caption text-text-3">New account</p>
              <p className="text-body font-semibold text-text">{resolved?.accountName}</p>
              <p className="text-footnote text-text-3">
                {bank.name} · {accountNumber}
              </p>
            </div>

            <p className="text-headline text-text">Confirm it&apos;s you</p>
            <p className="text-footnote mt-1 mb-4 text-text-3">We&apos;ll send a one-time code to confirm this change.</p>
            <SegmentedControl
              ariaLabel="Send code by"
              value={channel}
              onChange={(value) => {
                setChannel(value);
                setOtpDestination(null);
                setOtp("");
              }}
              options={[
                { label: "Phone (SMS)", value: "PHONE" },
                { label: "Email", value: "EMAIL" },
              ]}
            />

            {otpDestination ? (
              <>
                <p className="text-callout mt-5 flex items-center gap-2 text-text-2">
                  {channel === "PHONE" ? <Smartphone size={16} /> : <Mail size={16} />}
                  Code sent to {otpDestination}
                </p>
                <OTPInput length={OTP_LENGTH} value={otp} onChange={setOtp} />
                <Button loading={saveAccount.isPending} disabled={otp.length !== OTP_LENGTH} onClick={() => void save()}>
                  Save account
                </Button>
                <button
                  type="button"
                  disabled={resendIn > 0 || requestOtp.isPending}
                  onClick={() => void sendOtp()}
                  className="pressable-soft text-callout mx-auto mt-4 block font-medium text-accent disabled:text-text-4"
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </button>
              </>
            ) : (
              <div className="mt-5">
                <Button loading={requestOtp.isPending} onClick={() => void sendOtp()}>
                  Send code
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <BankPickerSheet
        open={isBankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        selectedCode={bank?.code}
        onSelect={(selected) => {
          setBank(selected);
          setBankPickerOpen(false);
        }}
      />
    </Screen>
  );
}
