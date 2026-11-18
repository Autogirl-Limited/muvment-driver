"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { VehicleCard } from "@/components/checklist/VehicleCard";
import { useAssignedVehicle, usePreRideChecklistSummary } from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { ChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";
import { readChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";

export default function ChecklistStep1Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() || undefined;
  const currentUserQuery = useCurrentUser();
  const [vehicleSelection, setVehicleSelection] = useState<ChecklistVehicleSelection>();
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId, { enabled: Boolean(activeTrackerId) });
  const checklistSummary = checklistSummaryQuery.data?.data;
  const selectedVehicle = activeTrackerId ? undefined : vehicleSelection?.vehicle;
  // The assigned vehicle is fetched live so a just-assigned vehicle shows at once.
  const assignedVehicleQuery = useAssignedVehicle();
  const assignedVehicle = assignedVehicleQuery.data ?? undefined;
  const summaryVehicle = checklistSummary?.vehicleInfo;
  const vehicleName = summaryVehicle?.vehicleName?.trim() || selectedVehicle?.name || assignedVehicle?.name;
  const vehicleIdentifier =
    summaryVehicle?.vehicleIdentifier?.trim() || selectedVehicle?.identifier || assignedVehicle?.identifier;
  const vehicleImage =
    (activeTrackerId ? summaryVehicle?.vehicleImageUrl?.trim() : undefined) ||
    selectedVehicle?.imageUrl ||
    assignedVehicle?.imageUrl ||
    undefined;
  const hasVehicle = Boolean(vehicleName || vehicleIdentifier);
  const isLoadingVehicle = !hasVehicle && assignedVehicleQuery.isLoading;
  const hasVehicleError = !hasVehicle && assignedVehicleQuery.isError;
  const isVehicleMissing = !hasVehicle && !isLoadingVehicle && !hasVehicleError;
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
        if (!hasVehicle && step > 1) return;
        if (activeTrackerId) {
          router.replace(
            getGuardedChecklistStepRoute({ flow: "preRide", requestedStep: step, summary: checklistSummary, trackerId: activeTrackerId }),
          );
          return;
        }
        router.replace(getPreRideStarterStepRoute(Math.min(step, 2)));
      }}
      footer={{
        children: isCheckingProgress
          ? "Checking progress..."
          : hasVehicleError
            ? "Retry vehicle check"
            : isVehicleMissing
              ? "No vehicle assigned"
              : checklistSummaryQuery.isError
                ? "Retry progress check"
                : "Next",
        loading: isCheckingProgress || isLoadingVehicle,
        disabled:
          isCheckingProgress ||
          isLoadingVehicle ||
          isVehicleMissing ||
          (Boolean(activeTrackerId) && !hasChecklistSummary && !checklistSummaryQuery.isError),
        onClick: () => {
          if (hasVehicleError) {
            void assignedVehicleQuery.refetch();
            return;
          }
          if (!hasVehicle) return;
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
      {hasVehicle ? (
        <VehicleCard
          model={vehicleName ?? vehicleIdentifier ?? ""}
          plate={vehicleName ? (vehicleIdentifier ?? "") : ""}
          imageUri={vehicleImage}
          statusText={selectedVehicle ? "Selected from booking invoice" : undefined}
        />
      ) : isLoadingVehicle ? (
        <p className="text-footnote text-text-3">Checking your assigned vehicle...</p>
      ) : (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="text-callout font-semibold text-text">
                {hasVehicleError ? "Couldn't check your vehicle" : "No vehicle assigned"}
              </p>
              <p className="text-footnote mt-1 text-text-2">
                {hasVehicleError
                  ? "Check your connection and retry. You can't continue until your vehicle is confirmed."
                  : "You can't start a Pilot Report without an assigned vehicle. Contact your dispatcher, or start a trip with a booking invoice."}
              </p>
            </div>
          </div>
        </div>
      )}
    </ChecklistShell>
  );
}
