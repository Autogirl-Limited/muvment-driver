"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { PilotReportBlockedBanner, PilotReportList } from "@/components/checklist/PilotReportList";
import { Sheet } from "@/components/ui/Dialog";
import { useOutstandingPilotReports } from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { OutstandingPilotReport, OutstandingPilotReports } from "@/lib/api/types";
import { isPilotReportsRequiredError, pilotReportRoute } from "@/lib/pilotReports/outstanding";
import { readChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
import { PENDING_INVOICE_RESUME_ROUTE } from "@/lib/utils/pendingInvoiceReport";

interface PilotReportGate {
  outstanding?: OutstandingPilotReports;
  isLoading: boolean;
  /** A report owed right now stops new work. */
  blocking: boolean;
  /**
   * Call before check-in, heading to pickup or starting a ride. Returns false
   * (and shows what to do) when reports are owed.
   */
  requireReportsDone: () => boolean;
  /** For a server refusal (PILOT_REPORTS_REQUIRED): refresh and show the sheet. Returns true if handled. */
  handleBlockedError: (error: unknown) => boolean;
  openReport: (report: OutstandingPilotReport) => void;
  opening: OutstandingPilotReport | null;
}

const PilotReportGateContext = createContext<PilotReportGate | null>(null);

export const usePilotReportGate = () => {
  const context = useContext(PilotReportGateContext);
  if (!context) throw new Error("usePilotReportGate must be used inside PilotReportGateProvider");
  return context;
};

/**
 * Keeps drivers on top of their pilot reports: the trip screens ask before
 * starting work. Every screen stays open, and a ride already in progress is
 * never held up.
 */
export const PilotReportGateProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const query = useOutstandingPilotReports();
  const userId = useCurrentUser().data?.data?.userId;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [opening, setOpening] = useState<OutstandingPilotReport | null>(null);
  const outstanding = query.data?.data;
  const blocking = Boolean(outstanding?.blocking);
  const { refetch } = query;

  const openReport = useCallback(
    (report: OutstandingPilotReport) => {
      setOpening(report);
      setSheetOpen(false);
      // An invoice report already begun today is that unstarted Pre-Ride: resume
      // it rather than losing the pick. Saved picks expire with the day.
      const resumesInvoice =
        report.kind === "PRE_RIDE" && !report.checklistTrackerId && Boolean(readChecklistVehicleSelection(userId));
      router.push(resumesInvoice ? PENDING_INVOICE_RESUME_ROUTE : pilotReportRoute(report));
      window.setTimeout(() => setOpening(null), 1_500);
    },
    [router, userId],
  );

  const requireReportsDone = useCallback(() => {
    if (!blocking) return true;
    setSheetOpen(true);
    return false;
  }, [blocking]);

  const handleBlockedError = useCallback(
    (error: unknown) => {
      if (!isPilotReportsRequiredError(error)) return false;
      void refetch();
      setSheetOpen(true);
      return true;
    },
    [refetch],
  );

  const gate = useMemo<PilotReportGate>(
    () => ({
      outstanding,
      isLoading: query.isLoading,
      blocking,
      requireReportsDone,
      handleBlockedError,
      openReport,
      opening,
    }),
    [blocking, handleBlockedError, openReport, opening, outstanding, query.isLoading, requireReportsDone],
  );

  return (
    <PilotReportGateContext.Provider value={gate}>
      {children}

      <Sheet open={sheetOpen && blocking} onClose={() => setSheetOpen(false)} title="Pilot reports first">
        <div className="space-y-4 pb-2">
          <PilotReportBlockedBanner message={outstanding?.message} />
          {outstanding && (
            <PilotReportList reports={outstanding.reports} today={outstanding.today} onOpen={openReport} opening={opening} />
          )}
        </div>
      </Sheet>
    </PilotReportGateContext.Provider>
  );
};
