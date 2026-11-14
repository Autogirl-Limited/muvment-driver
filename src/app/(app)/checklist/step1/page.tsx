"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { VehicleCard } from "@/components/checklist/VehicleCard";
import { usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { ChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";
import { readChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";

const getDisplayValue = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

export default function ChecklistStep1Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() || undefined;
  const currentUserQuery = useCurrentUser();
  const [vehicleSelection, setVehicleSelection] = useState<ChecklistVehicleSelection>();
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId, { enabled: Boolean(activeTrackerId) });
  const checklistSummary = checklistSummaryQuery.data?.data;
  const selectedVehicle = activeTrackerId ? undefined : vehicleSelection?.vehicle;
  const vehicleName = getDisplayValue(
    checklistSummary?.vehicleInfo?.vehicleName ?? selectedVehicle?.name,
    "Vehicle unavailable",
  );
  const vehicleIdentifier = getDisplayValue(
    checklistSummary?.vehicleInfo?.vehicleIdentifier ?? selectedVehicle?.identifier,
    "Identifier unavailable",
  );
  const hasChecklistSummary = Boolean(checklistSummary);
  const isCheckingProgress = Boolean(activeTrackerId) && !hasChecklistSummary && checklistSummaryQuery.isFetching;

  useEffect(() => {
    setVehicleSelection(readChecklistVehicleSelection(currentUserQuery.data?.data.userId));
  }, [currentUserQuery.data?.data.userId]);

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
      <VehicleCard
        model={vehicleName}
        plate={vehicleIdentifier}
        imageUri={selectedVehicle?.imageUrl ?? undefined}
        statusText={selectedVehicle ? "Selected from booking invoice" : undefined}
      />
    </ChecklistShell>
  );
}
