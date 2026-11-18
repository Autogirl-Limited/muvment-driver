"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Plus } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useIncidentReports } from "@/lib/api/hooks/useTrips";
import { categoryInfo, parseDescription, readIncidentDraft, type IncidentDraft } from "@/lib/incident/incidentDraft";

export default function IncidentReportsPage() {
  const router = useRouter();
  const incidentReportsQuery = useIncidentReports({ page: 0, size: 50 });
  const [draft, setDraft] = useState<IncidentDraft>();
  const reports = incidentReportsQuery.data?.data.content ?? [];
  const errorMessage = getApiErrorMessage(incidentReportsQuery.error);

  // Read on the client: the draft lives in this phone's storage.
  useEffect(() => {
    setDraft(readIncidentDraft());
  }, []);

  return (
    <Screen>
      <NavBar
        left={<BackButton />}
        right={
          <button
            type="button"
            onClick={() => router.push("/incident-report")}
            className="pressable inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-text"
          >
            <Plus size={14} />
            New
          </button>
        }
        largeTitle="Incident Reports"
        subtitle="Reports you've sent, and any you haven't finished."
      />

      <div className="px-5 pb-10">
        {draft && (
          <>
            <SectionHeader>Not Sent Yet</SectionHeader>
            <button
              type="button"
              onClick={() => router.push("/incident-report")}
              className="card pressable mb-5 flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-text">
                <AlertTriangle size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body block font-semibold text-text">
                  Unsent report{draft.tripLabel ? ` · ${draft.tripLabel}` : ""}
                </span>
                <span className="text-footnote block truncate text-text-3">
                  {draft.tripId ? "Carry on where you stopped" : "Choose the trip to carry on"}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-text-4" />
            </button>
          </>
        )}

        {incidentReportsQuery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : incidentReportsQuery.isError ? (
          <EmptyState title="Unable to load reports" description={errorMessage ?? "Please check your connection and try again."} />
        ) : reports.length === 0 ? (
          <EmptyState title="No incident reports" description="Submitted incident reports will appear here." />
        ) : (
          <>
            <SectionHeader>Sent</SectionHeader>
            {reports.map((report) => {
              const { category, text } = parseDescription(report.description);

              return (
                <article key={report.id} className="card anim-fade-in mb-3 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                      <AlertTriangle size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold text-text">
                        {categoryInfo(category?.value)?.label ?? "Incident Report"}
                      </p>
                      <p className="text-caption mt-0.5 truncate text-text-3">Trip ID: {report.tripId}</p>
                    </div>
                  </div>
                  {Boolean(report.imageUrl?.trim()) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={report.imageUrl} alt="Incident photo" className="mb-3 h-44 w-full rounded-xl bg-surface-alt object-cover" loading="lazy" />
                  )}
                  <p className="text-footnote text-text-2">{text}</p>
                </article>
              );
            })}
          </>
        )}
      </div>
    </Screen>
  );
}
