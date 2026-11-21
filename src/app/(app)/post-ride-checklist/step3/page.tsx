"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { DashboardReadingNote } from "@/components/checklist/AiPhotoNotes";
import {
  DashboardAnalysisNotice,
  FeatureChips,
  isMetadataValid,
  parseNumericInput,
  ReadingsFields,
} from "@/components/checklist/InteriorStep";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { useDashboardReadingFlow } from "@/hooks/useDashboardReadingFlow";
import { useStepGate } from "@/hooks/useStepGate";
import { clearPhotoDraft, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePostRideChecklistAggregate,
  useSubmitInteriorChecklist,
  useUpdateInteriorMetadata,
  useVehicleFeatures,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { InteriorUploadImage } from "@/lib/api/types";
import { getChecklistStepRoute, getGuardedChecklistStepRoute } from "@/lib/utils/checklistNavigation";
import { POST_RIDE_STEP_LOCK_ENABLED } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { usePersistentIdempotencyKey } from "@/lib/utils/persistentIdempotencyKey";
import { useToast } from "@/providers/ToastProvider";

type InteriorKey = "dashboard" | "driverSide" | "passengerSide" | "rearSeats" | "boot" | "accessories";

const INTERIOR_KEYS: readonly InteriorKey[] = ["dashboard", "driverSide", "passengerSide", "rearSeats", "boot", "accessories"];
const PHOTO_KEYS = ["dashboard", "driverSide", "passengerSide", "rearSeats", "boot"] as const;
const INTERIOR_IMAGE_TYPES: Record<InteriorKey, InteriorUploadImage> = {
  boot: "BOOT",
  dashboard: "DASHBOARD",
  driverSide: "DRIVER_SIDE",
  passengerSide: "PASSENGER",
  rearSeats: "REAR_SEATS",
  accessories: "ACCESSORIES",
};
const INTERIOR_LABELS: Record<(typeof PHOTO_KEYS)[number], { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Required: show the odometer and fuel gauge clearly" },
  driverSide: { title: "Driver Side", subtitle: "Optional photo of the seat, door, and floor" },
  passengerSide: { title: "Passenger Side", subtitle: "Optional photo of the seat, floor, and glove box" },
  rearSeats: { title: "Rear Seats", subtitle: "Optional photo of the rear seats and floor" },
  boot: { title: "Boot/Trunk", subtitle: "Optional photo of the trunk and spare tire area" },
};

export default function PostRideStep3Page() {
  const router = useRouter();
  const toast = useToast();
  const activeTrackerId = useSearchParams().get("trackerId")?.trim() ?? "";
  const aggregateQuery = usePostRideChecklistAggregate(activeTrackerId);
  const submitInteriorChecklist = useSubmitInteriorChecklist();
  const updateInteriorMetadata = useUpdateInteriorMetadata();
  const currentUserQuery = useCurrentUser();
  const vehicleFeaturesQuery = useVehicleFeatures(currentUserQuery.data?.data.vehicleId, { enabled: !currentUserQuery.isLoading });
  const aggregate = aggregateQuery.data?.data;
  const savedInteriorSummary = aggregate?.postTripSummary?.interiorPhotos;
  const savedMetadata = savedInteriorSummary?.metadata ?? aggregate?.postTripSummary?.vehicleMetadata;
  const hasSavedInteriorSubmission = savedInteriorSummary?.valid === true;
  const idempotencyKey = usePersistentIdempotencyKey(`post-trip-interior-${activeTrackerId}`);
  const slots = usePhotoSlots(INTERIOR_KEYS, activeTrackerId ? `post-interior:${activeTrackerId}` : undefined);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>();
  const vehicleFeatures = (vehicleFeaturesQuery.data?.data ?? []).filter((feature) => feature.category !== "SAFETY_EQUIPMENT");

  const stepGate = useStepGate({
    aggregate: aggregate,
    flow: "postRide",
    isError: aggregateQuery.isError,
    isFetching: aggregateQuery.isFetching,
    onRecheck: () => void aggregateQuery.refetch(),
    step: 3,
    trackerId: activeTrackerId,
  });

  const dashboardPhoto = slots.photos.dashboard;
  const hasDashboardUploaded = isChecklistPhotoUploaded(dashboardPhoto);
  const readings = useDashboardReadingFlow({
    checklistType: "POST_TRIP",
    dashboardUploading: dashboardPhoto.status === "uploading",
    dashboardUrl: isChecklistPhotoUploaded(dashboardPhoto) ? dashboardPhoto.fileUrl : undefined,
    hasSavedSubmission: hasSavedInteriorSubmission,
    savedMetadata,
    trackerId: activeTrackerId || undefined,
  });
  const odometerKM = parseNumericInput(readings.odometer);
  const fuelLevelInPercentage = parseNumericInput(readings.fuelLevel);
  const hasValidMetadata = isMetadataValid(odometerKM, fuelLevelInPercentage);
  const isSubmitting = submitInteriorChecklist.isPending || updateInteriorMetadata.isPending;
  const isNextEnabled =
    Boolean(activeTrackerId) &&
    Boolean(aggregate) &&
    (hasSavedInteriorSubmission || hasDashboardUploaded) &&
    hasValidMetadata &&
    !readings.isReadingPending &&
    !slots.hasPendingUpload &&
    !slots.hasFailedUpload &&
    !isSubmitting;

  /** Saves the interior photos (once) and the readings as shown, then moves on. */
  const handleNext = async () => {
    if (!activeTrackerId) return;
    if (!hasSavedInteriorSubmission && !hasDashboardUploaded) {
      toast.error("Dashboard photo needed", "Take the dashboard photo first.");
      return;
    }
    if (!isNextEnabled || odometerKM === undefined || fuelLevelInPercentage === undefined) return;

    try {
      if (!hasSavedInteriorSubmission) {
        const accessoryPhoto = slots.photos.accessories;
        const accessoryUploadPhoto =
          isChecklistPhotoUploaded(accessoryPhoto) && selectedFeatureId
            ? { ...toChecklistUploadedPhoto(accessoryPhoto), interiorUploadImage: "ACCESSORIES" as const, publicCloudID: selectedFeatureId }
            : undefined;

        try {
          await submitInteriorChecklist.mutateAsync({
            idempotencyKey,
            payload: {
              checklistTrackerId: activeTrackerId,
              checklistType: "POST_TRIP",
              uploadPhotos: [
                ...PHOTO_KEYS.filter((key) => isChecklistPhotoUploaded(slots.photos[key])).map((key) => ({
                  ...toChecklistUploadedPhoto(slots.photos[key]),
                  interiorUploadImage: INTERIOR_IMAGE_TYPES[key],
                })),
                ...(accessoryUploadPhoto ? [accessoryUploadPhoto] : []),
              ],
            },
            trackerId: activeTrackerId,
          });
        } catch (error) {
          // Already saved (a retry after a dropped response): carry on.
          if (!isChecklistStepConflictError(error)) throw error;
        }
      }

      await updateInteriorMetadata.mutateAsync({
        payload: { checklistTrackerId: activeTrackerId, checklistType: "POST_TRIP", fuelLevelInPercentage, odometerKM },
        trackerId: activeTrackerId,
      });
      clearPhotoDraft(`post-interior:${activeTrackerId}`);
      router.push(getChecklistStepRoute("postRide", activeTrackerId, 4));
    } catch (error) {
      toast.error("Couldn't save the interior", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  if (!activeTrackerId) {
    return (
      <Screen>
        <NavBar left={<BackButton href="/home" />} />
        <EmptyState title="Report unavailable" description="Missing checklist tracker. Please open the report from Home." />
      </Screen>
    );
  }

  return (
    <ChecklistShell
      currentStep={3}
      allowForward={!POST_RIDE_STEP_LOCK_ENABLED}
      stepLabels={["Vehicle", "Exterior", "Interior", "Submit"]}
      title="Interior Photos"
      banner="Capture the dashboard clearly. We read the odometer and fuel level for you; check them, then confirm."
      onStepPress={(step) =>
        router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
      }
      footer={{
        children: aggregateQuery.isError
          ? "Retry progress check"
          : isSubmitting
            ? "Saving..."
            : readings.isReadingPending
              ? "Reading dashboard..."
              : "Confirm readings",
        loading: isSubmitting || readings.isReadingPending,
        disabled: stepGate.blocked || (!isNextEnabled && !aggregateQuery.isError),
        onClick: () => {
          if (aggregateQuery.isError) {
            void aggregateQuery.refetch();
            return;
          }
          void handleNext();
        },
      }}
    >
      {stepGate.notice}
      {PHOTO_KEYS.map((key) => (
        <PhotoUploadCard
          key={key}
          title={INTERIOR_LABELS[key].title}
          subtitle={slots.subtitleFor(key, INTERIOR_LABELS[key].subtitle)}
          imageUri={slots.photos[key].localUri}
          uploading={slots.photos[key].status === "uploading"}
          failed={slots.photos[key].status === "failed"}
          onClick={() => void slots.capture({ key, label: `post-interior-${INTERIOR_IMAGE_TYPES[key]}`, entityId: activeTrackerId })}
          onRemove={() => void slots.remove(key)}
        />
      ))}

      {vehicleFeatures.length > 0 && (
        <>
          <ChecklistSectionTitle className="mt-2">Accessory Feature (Optional)</ChecklistSectionTitle>
          <FeatureChips
            features={vehicleFeatures}
            selectedIds={selectedFeatureId ? [selectedFeatureId] : []}
            onToggle={(id) => setSelectedFeatureId((current) => (current === id ? undefined : id))}
          />
          <PhotoUploadCard
            title="Accessories"
            subtitle={slots.subtitleFor("accessories", "Select a feature, then capture it")}
            imageUri={slots.photos.accessories.localUri}
            uploading={slots.photos.accessories.status === "uploading"}
            failed={slots.photos.accessories.status === "failed"}
            onClick={() =>
              void slots.capture({
                key: "accessories",
                label: "post-interior-ACCESSORIES",
                entityId: activeTrackerId,
                beforeCapture: () => {
                  if (!selectedFeatureId) {
                    toast.error("Select a vehicle feature", "Choose the feature shown in the accessory photo first.");
                    return false;
                  }
                  return true;
                },
              })
            }
            onRemove={() => void slots.remove("accessories")}
          />
        </>
      )}

      <DashboardAnalysisNotice
        analyzing={readings.isReadingPending}
        failed={readings.failed}
        manual={false}
        slow={readings.slow}
        onManual={readings.takeOver}
        onRetry={readings.retry}
      />

      <ChecklistSectionTitle className="mt-2">Vehicle Readings</ChecklistSectionTitle>
      <ReadingsFields
        odometer={readings.odometer}
        fuelLevel={readings.fuelLevel}
        onOdometerChange={readings.setOdometer}
        onFuelLevelChange={readings.setFuelLevel}
      />
      {(hasDashboardUploaded || hasSavedInteriorSubmission) && (
        <DashboardReadingNote trackerId={activeTrackerId || undefined} checklistType="POST_TRIP" />
      )}
    </ChecklistShell>
  );
}
