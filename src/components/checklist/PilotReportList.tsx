"use client";

import { ChevronRight, ClipboardList, Flag, Lock } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import type { OutstandingPilotReport } from "@/lib/api/types";
import { pilotReportDetail, pilotReportTitle } from "@/lib/pilotReports/outstanding";

const keyOf = (report: OutstandingPilotReport) => `${report.kind}-${report.checklistTrackerId ?? "new"}-${report.date}`;

/** One row per report owed. Blocking ones read as required; the rest as "later". */
export const PilotReportList = ({
  reports,
  today,
  onOpen,
  opening,
}: {
  reports: OutstandingPilotReport[];
  today: string;
  onOpen: (report: OutstandingPilotReport) => void;
  /** The report being opened, to show it busy. */
  opening?: OutstandingPilotReport | null;
}) => (
  <ul className="space-y-3" aria-label="Pilot reports to do">
    {reports.map((report) => {
      const isPre = report.kind === "PRE_RIDE";
      const busy = opening ? keyOf(opening) === keyOf(report) : false;

      return (
        <li key={keyOf(report)}>
          <button
            type="button"
            onClick={() => onOpen(report)}
            disabled={busy}
            className={`card pressable flex w-full items-center gap-3 p-4 text-left disabled:cursor-wait disabled:opacity-70 ${
              report.blocking ? "border border-danger/35" : ""
            }`}
          >
            {/* Blue for the morning report, amber for the end-of-day one. */}
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isPre ? "bg-surface-soft text-[#3538CD] dark:text-accent" : "bg-warning-soft text-warning-text"
              }`}
            >
              {isPre ? <ClipboardList size={20} /> : <Flag size={20} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-body font-semibold text-text">{pilotReportTitle(report)}</span>
                {report.blocking ? (
                  <Pill tone="danger">Required</Pill>
                ) : report.state === "IN_PROGRESS" ? (
                  <Pill tone="accent">Started</Pill>
                ) : null}
              </span>
              <span className="text-footnote mt-0.5 block text-text-3">
                {busy ? "Opening your report..." : pilotReportDetail(report, today)}
              </span>
            </span>
            <ChevronRight size={20} className="shrink-0 text-text-4" />
          </button>
        </li>
      );
    })}
  </ul>
);

/**
 * Today's report when the server doesn't list it, worked out from today's
 * checklist. No Required label and no blocking: only the server's list does that.
 */
export const UnlistedReportCard = ({
  kind,
  detail,
  onOpen,
}: {
  kind: OutstandingPilotReport["kind"];
  detail: string;
  onOpen: () => void;
}) => {
  const isPre = kind === "PRE_RIDE";

  return (
    <button type="button" onClick={onOpen} className="card pressable flex w-full items-center gap-3 p-4 text-left">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isPre ? "bg-surface-soft text-[#3538CD] dark:text-accent" : "bg-warning-soft text-warning-text"
        }`}
      >
        {isPre ? <ClipboardList size={20} /> : <Flag size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-body block font-semibold text-text">
          {isPre ? "Pre-Ride Pilot Report" : "Post-Ride Pilot Report"}
        </span>
        <span className="text-footnote mt-0.5 block text-text-3">{detail}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-text-4" />
    </button>
  );
};

/** "Finish these to start work" banner above a blocking list. */
export const PilotReportBlockedBanner = ({ message }: { message?: string | null }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-danger-soft px-4 py-3" role="alert">
    <Lock size={18} className="mt-0.5 shrink-0 text-danger-text" />
    <div className="min-w-0">
      <p className="text-callout font-semibold text-danger-text">Finish your pilot reports to start work</p>
      <p className="text-footnote mt-0.5 text-danger-text/85">
        {message ?? "Check-in and starting a ride open again once they're sent."}
      </p>
    </div>
  </div>
);
