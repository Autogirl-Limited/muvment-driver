"use client";

import { AlertTriangle } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useIncidentReports } from "@/lib/api/hooks/useTrips";

export default function IncidentReportsPage() {
  const incidentReportsQuery = useIncidentReports({ page: 0, size: 50 });
  const reports = incidentReportsQuery.data?.data.content ?? [];
  const errorMessage = getApiErrorMessage(incidentReportsQuery.error);

  return (
    <Screen>
      <NavBar
        left={<BackButton />}
        largeTitle="Incident Reports"
        subtitle="Review all incident reports submitted from your driver account."
      />

      <div className="px-5 pb-10">
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
          reports.map((report) => (
            <article key={report.id} className="card anim-fade-in mb-3 p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                  <AlertTriangle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-text">Incident Report</p>
                  <p className="text-caption mt-0.5 truncate text-text-3">Trip ID: {report.tripId}</p>
                </div>
              </div>
              {Boolean(report.imageUrl?.trim()) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={report.imageUrl} alt="Incident" className="mb-3 h-44 w-full rounded-xl bg-surface-alt object-cover" loading="lazy" />
              )}
              <p className="text-footnote text-text-2">{report.description}</p>
            </article>
          ))
        )}
      </div>
    </Screen>
  );
}
