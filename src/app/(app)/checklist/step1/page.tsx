"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { VehicleCard } from "@/components/checklist/VehicleCard";
import { usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";

const getDisplayValue = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

export default function ChecklistStep1Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() || undefined;
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId, { enabled: Boolean(activeTrackerId) });
  const checklistSummary = checklistSummaryQuery.data?.data;
  const vehicleName = getDisplayValue(
    checklistSummary?.vehicleInfo?.vehicleName,
    "Vehicle unavailable",
  );
  const vehicleIdentifier = getDisplayValue(
    checklistSummary?.vehicleInfo?.vehicleIdentifier,
    "Identifier unavailable",
  );
  const hasChecklistSummary = Boolean(checklistSummary);
  const isCheckingProgress = Boolean(activeTrackerId) && !hasChecklistSummary && checklistSummaryQuery.isFetching;

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
        router.replace(getPreRideStarterStepRoute(Math.min(step, 2)));
      }}
      footer={{
        children: isCheckingProgress ? "Checking progress..." : checklistSummaryQuery.isError ? "Retry progress check" : "Next",
        loading: isCheckingProgress,
        disabled:
          isCheckingProgress ||
          (Boolean(activeTrackerId) && !hasChecklistSummary && !checklistSummaryQuery.isError),
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
          router.push(getPreRideStarterStepRoute(2));
        },
      }}
    >
      <ChecklistSectionTitle>Assigned Vehicle</ChecklistSectionTitle>
      <VehicleCard model={vehicleName} plate={vehicleIdentifier} />
    </ChecklistShell>
  );
}
