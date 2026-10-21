"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { VehicleCard } from "@/components/checklist/VehicleCard";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrip, useDriverTrips } from "@/lib/api/hooks/useTrips";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";
import { getAvailablePreRidePilotReportTrip } from "@/lib/utils/pilotReports";

const getDisplayValue = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

export default function ChecklistStep1Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() || undefined;
  const starterTripId = searchParams.get("tripId")?.trim() || undefined;
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId, { enabled: Boolean(activeTrackerId) });
  const starterTripQuery = useDriverTrip(starterTripId);
  const driverTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const checklistSummary = checklistSummaryQuery.data?.data;
  const fallbackTrip = getAvailablePreRidePilotReportTrip(driverTripsQuery.data?.data.content ?? []);
  const vehicleName = getDisplayValue(
    checklistSummary?.vehicleInfo?.vehicleName ?? starterTripQuery.data?.data.vehicleName ?? fallbackTrip?.vehicleName,
    "Vehicle unavailable",
  );
  const vehicleIdentifier = getDisplayValue(
    checklistSummary?.vehicleInfo?.vehicleIdentifier ??
      starterTripQuery.data?.data.vehicleIdentifier ??
      fallbackTrip?.vehicleIdentifier,
    "Identifier unavailable",
  );
  const hasChecklistSummary = Boolean(checklistSummary);
  const isCheckingProgress = Boolean(activeTrackerId) && !hasChecklistSummary && checklistSummaryQuery.isFetching;

  if (!activeTrackerId && !starterTripId) {
    return (
      <Screen>
        <NavBar left={<BackButton href="/home" />} />
        <EmptyState title="Report unavailable" description="Missing checklist tracker. Please go back and select the report again." />
      </Screen>
    );
  }

  return (
    <ChecklistShell
      currentStep={1}
      title="Pre Ride Pilot Report"
      onStepPress={(step) => {
        if (activeTrackerId) {
          router.replace(
            getGuardedChecklistStepRoute({ flow: "preRide", requestedStep: step, summary: checklistSummary, trackerId: activeTrackerId }),
          );
          return;
        }
        if (starterTripId) {
          router.replace(getPreRideStarterStepRoute(starterTripId, Math.min(step, 2)));
        }
      }}
      footer={{
        children: isCheckingProgress ? "Checking progress..." : checklistSummaryQuery.isError ? "Retry progress check" : "Next",
        loading: isCheckingProgress,
        disabled:
          isCheckingProgress ||
          (Boolean(activeTrackerId) && !hasChecklistSummary && !checklistSummaryQuery.isError) ||
          (!activeTrackerId && !starterTripId),
        onClick: () => {
          if (activeTrackerId && checklistSummaryQuery.isError) {
            void checklistSummaryQuery.refetch();
            return;
          }
          if (activeTrackerId && checklistSummary) {
            // Resuming always lands on the exterior step so photos stay reviewable.
            router.push(getChecklistStepRoute("preRide", activeTrackerId, 2));
            return;
          }
          if (starterTripId) {
            router.push(getPreRideStarterStepRoute(starterTripId, 2));
          }
        },
      }}
    >
      <ChecklistSectionTitle>Assigned Vehicle</ChecklistSectionTitle>
      <VehicleCard model={vehicleName} plate={vehicleIdentifier} />
    </ChecklistShell>
  );
}
