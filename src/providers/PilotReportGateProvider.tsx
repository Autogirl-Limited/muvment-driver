"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardCheck, Home } from "lucide-react";

import { PilotReportBlockedBanner, PilotReportList } from "@/components/checklist/PilotReportList";
import { TabBar } from "@/components/layout/TabBar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { Screen } from "@/components/ui/Screen";
import { useOutstandingPilotReports } from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { OutstandingPilotReport, OutstandingPilotReports } from "@/lib/api/types";
import { isPilotReportGatedPath, isPilotReportsRequiredError, pilotReportRoute } from "@/lib/pilotReports/outstanding";
import { clearChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";

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

const TAB_ROOTS = ["/trips", "/payments"];

/** Full-screen stop for Trips / Payments while a blocking report is owed. */
const PilotReportGateScreen = ({ gate, withTabBar }: { gate: PilotReportGate; withTabBar: boolean }) => {
  const router = useRouter();
  const outstanding = gate.outstanding;

  return (
    <>
      <Screen withTabBar={withTabBar}>
        <div className="anim-rise-in px-5 pt-[calc(var(--safe-top)+32px)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-text">
            <ClipboardCheck size={28} />
          </span>
          <h1 className="text-title-1 mt-4 text-text">Pilot reports first</h1>
          <p className="text-callout mt-2 text-text-2">
            {outstanding?.message ?? "Finish your pilot reports to start work."} This opens again as soon as they&apos;re
            sent.
          </p>
          {outstanding && (
            <div className="mt-6">
              <PilotReportList
                reports={outstanding.reports}
                today={outstanding.today}
                onOpen={gate.openReport}
                opening={gate.opening}
              />
            </div>
          )}
          <div className="mt-6">
            <Button variant="outline" icon={<Home size={18} />} onClick={() => router.push("/home")}>
              Go to Home
            </Button>
          </div>
        </div>
      </Screen>
      {withTabBar && <TabBar />}
    </>
  );
};

/**
 * Keeps drivers on top of their pilot reports: Trips and Payments close while
 * a blocking report is owed, and the trip screens ask before starting work.
 * A ride already in progress is never held up.
 */
export const PilotReportGateProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
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
      // A fresh Pre-Ride report starts from the vehicle step, not a stale pick.
      if (report.kind === "PRE_RIDE" && !report.checklistTrackerId) clearChecklistVehicleSelection(userId);
      router.push(pilotReportRoute(report));
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

  const gated = blocking && isPilotReportGatedPath(pathname);

  return (
    <PilotReportGateContext.Provider value={gate}>
      {gated ? <PilotReportGateScreen gate={gate} withTabBar={TAB_ROOTS.includes(pathname)} /> : children}

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
