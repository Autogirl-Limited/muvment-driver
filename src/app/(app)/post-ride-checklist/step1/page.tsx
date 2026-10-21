"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { VehicleCard } from "@/components/checklist/VehicleCard";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { usePostRideChecklistAggregate } from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrips } from "@/lib/api/hooks/useTrips";
import { getChecklistStepRoute, getGuardedChecklistStepRoute, getPostRideUnlockedStep } from "@/lib/utils/checklistNavigation";
import { getAvailablePreRidePilotReportTrip, getPostRidePilotReportTrip } from "@/lib/utils/pilotReports";

const getDisplayValue = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

export default function PostRideStep1Page() {
  const router = useRouter();
  const activeTrackerId = useSearchParams().get("trackerId")?.trim() || undefined;
  const aggregateQuery = usePostRideChecklistAggregate(activeTrackerId);
  const driverTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const aggregate = aggregateQuery.data?.data;
  const hasAggregate = Boolean(aggregate);
  const isCheckingProgress = !hasAggregate && aggregateQuery.isFetching;
  const driverTrips = driverTripsQuery.data?.data.content ?? [];
  const fallbackTrip = getPostRidePilotReportTrip(driverTrips) ?? getAvailablePreRidePilotReportTrip(driverTrips);
  const vehicleName = getDisplayValue(aggregate?.preTripSummary.vehicleInfo?.vehicleName ?? fallbackTrip?.vehicleName, "Vehicle unavailable");
  const vehicleIdentifier = getDisplayValue(
    aggregate?.preTripSummary.vehicleInfo?.vehicleIdentifier ?? fallbackTrip?.vehicleIdentifier,
    "Identifier unavailable",
  );

  if (!activeTrackerId) {
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
      title="Post Ride Pilot Report"
      onStepPress={(step) =>
        router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
      }
      footer={{
        children: isCheckingProgress ? "Checking progress..." : aggregateQuery.isError ? "Retry progress check" : "Next",
        loading: isCheckingProgress,
        disabled: isCheckingProgress || (!hasAggregate && !aggregateQuery.isError),
        onClick: () => {
          if (aggregateQuery.isError) {
            void aggregateQuery.refetch();
            return;
          }
          router.push(getChecklistStepRoute("postRide", activeTrackerId, getPostRideUnlockedStep(aggregate)));
        },
      }}
    >
      <ChecklistSectionTitle>Assigned Vehicle</ChecklistSectionTitle>
      <VehicleCard model={vehicleName} plate={vehicleIdentifier} />
    </ChecklistShell>
  );
}
