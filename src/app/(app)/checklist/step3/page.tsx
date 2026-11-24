"use client";

import { useEffect, useState } from "react";
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
import { useDashboardReadingFlow } from "@/hooks/useDashboardReadingFlow";
import { useStepGate } from "@/hooks/useStepGate";
import { clearPhotoDraft, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  submittedImagesFor,
  usePreRideChecklistSummary,
  useSubmitInteriorChecklist,
  useSubmittedChecklistPhotos,
  useUpdateInteriorMetadata,
  useVehicleFeatures,
} from "@/lib/api/hooks/usePreRideChecklist";
import type { InteriorUploadImage } from "@/lib/api/types";
import { getChecklistStepRoute, getGuardedChecklistStepRoute } from "@/lib/utils/checklistNavigation";
import { PRE_RIDE_STEP_LOCK_ENABLED } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, pickSubmittedImages, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { usePersistentIdempotencyKey } from "@/lib/utils/persistentIdempotencyKey";
import { useToast } from "@/providers/ToastProvider";

type InteriorKey = "dashboard" | "driverSide" | "passengerSide" | "rearSeats" | "boot" | "accessories";

const INTERIOR_KEYS: readonly InteriorKey[] = ["dashboard", "driverSide", "passengerSide", "rearSeats", "boot", "accessories"];
const INTERIOR_IMAGE_TYPES: Record<InteriorKey, InteriorUploadImage> = {
  boot: "BOOT",
  dashboard: "DASHBOARD",
  driverSide: "DRIVER_SIDE",
  passengerSide: "PASSENGER",
  rearSeats: "REAR_SEATS",
  accessories: "ACCESSORIES",
};
const INTERIOR_LABELS: Record<Exclude<InteriorKey, "accessories">, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Must show odometer AND fuel gauge clearly" },
  driverSide: { title: "Driver Side", subtitle: "Optional photo of the seat, door, and floor" },
  passengerSide: { title: "Passenger Side", subtitle: "Optional photo of the seat, floor, and glove box" },
  rearSeats: { title: "Rear Seats", subtitle: "Optional photo of the rear seats and floor" },
  boot: { title: "Boot/Trunk", subtitle: "Optional photo of the trunk and spare tire area" },
};
const PHOTO_KEYS = ["dashboard", "driverSide", "passengerSide", "rearSeats", "boot"] as const;

export default function ChecklistStep3Page() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() ?? "";
  const submitInteriorChecklist = useSubmitInteriorChecklist();
  const updateInteriorMetadata = useUpdateInteriorMetadata();
  const idempotencyKey = usePersistentIdempotencyKey(`pre-trip-interior-${activeTrackerId}`);
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId);
  const checklistSummary = checklistSummaryQuery.data?.data;
  // The full accessories catalogue, same as the mobile app: the driver photographs
  // whichever features the car has. Not per vehicle id, which can come back empty.
  const vehicleFeaturesQuery = useVehicleFeatures(undefined);
  const savedMetadata = checklistSummary?.interiorPhotos?.metadata;
  const hasSavedInteriorSubmission = checklistSummary?.interiorPhotos?.valid === true;
  const slots = usePhotoSlots(INTERIOR_KEYS, activeTrackerId ? `interior:${activeTrackerId}` : undefined);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const vehicleFeatures = (vehicleFeaturesQuery.data?.data ?? []).filter((feature) => feature.category !== "SAFETY_EQUIPMENT");

  // Saved on another phone (or this one lost its copy): show what was submitted.
  const submittedQuery = useSubmittedChecklistPhotos(activeTrackerId || undefined, { enabled: hasSavedInteriorSubmission });
  const { restore: restoreSlots } = slots;
  useEffect(() => {
    const images = submittedImagesFor(submittedQuery.data, "INTERIOR", "PRE_TRIP");
    if (images.length === 0) return;
    restoreSlots(pickSubmittedImages(images, INTERIOR_IMAGE_TYPES));
    const featureIds = images.flatMap((image) => (image.type === "ACCESSORIES" && image.publicId ? [image.publicId] : []));
    setSelectedFeatureIds((prev) => (prev.length > 0 || featureIds.length === 0 ? prev : [...new Set(featureIds)]));
  }, [restoreSlots, submittedQuery.data]);

  const stepGate = useStepGate({
    summary: checklistSummary,
    flow: "preRide",
    isError: checklistSummaryQuery.isError,
    isFetching: checklistSummaryQuery.isFetching,
    onRecheck: () => void checklistSummaryQuery.refetch(),
    step: 3,
    trackerId: activeTrackerId,
  });

  const dashboardPhoto = slots.photos.dashboard;
  const hasDashboardUploaded = isChecklistPhotoUploaded(dashboardPhoto);
  const readings = useDashboardReadingFlow({
    checklistType: "PRE_TRIP",
    dashboardUploading: dashboardPhoto.status === "uploading",
    // A dashboard shown from the server was already read: it must not start a new reading.
    dashboardUrl: isChecklistPhotoUploaded(dashboardPhoto) && !slots.isRestored(dashboardPhoto) ? dashboardPhoto.fileUrl : undefined,
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
    Boolean(checklistSummary) &&
    (hasSavedInteriorSubmission || hasDashboardUploaded) &&
    hasValidMetadata &&
    !readings.isReadingPending &&
    !slots.hasPendingUpload &&
    !slots.hasFailedUpload &&
    !isSubmitting;

  /** Saves the interior photos (once) and the readings as shown, then moves on. */
  const handleNext = async () => {
    if (!activeTrackerId) {
      toast.error("Report unavailable", "Please complete exterior photos first.");
      return;
    }
    if (!hasSavedInteriorSubmission && !hasDashboardUploaded) {
      toast.error("Dashboard photo needed", "Take the dashboard photo first.");
      return;
    }
    if (!isNextEnabled || odometerKM === undefined || fuelLevelInPercentage === undefined) return;

    try {
      if (!hasSavedInteriorSubmission) {
        // Each selected feature becomes its own ACCESSORIES entry pointing at the one accessory photo.
        const accessoryPhoto = slots.photos.accessories;
        const accessoryUploadPhotos =
          isChecklistPhotoUploaded(accessoryPhoto) && selectedFeatureIds.length > 0
            ? selectedFeatureIds.map((featureId) => ({
                ...toChecklistUploadedPhoto(accessoryPhoto),
                interiorUploadImage: "ACCESSORIES" as const,
                publicCloudID: featureId,
              }))
            : [];

        try {
          await submitInteriorChecklist.mutateAsync({
            idempotencyKey,
            payload: {
              checklistTrackerId: activeTrackerId,
              checklistType: "PRE_TRIP",
              uploadPhotos: [
                ...PHOTO_KEYS.filter((key) => isChecklistPhotoUploaded(slots.photos[key])).map((key) => ({
                  ...toChecklistUploadedPhoto(slots.photos[key]),
                  interiorUploadImage: INTERIOR_IMAGE_TYPES[key],
                })),
                ...accessoryUploadPhotos,
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
        payload: { checklistTrackerId: activeTrackerId, checklistType: "PRE_TRIP", fuelLevelInPercentage, odometerKM },
        trackerId: activeTrackerId,
      });
      clearPhotoDraft(`interior:${activeTrackerId}`);
      router.push(getChecklistStepRoute("preRide", activeTrackerId, 4));
    } catch (error) {
      toast.error(
        "Couldn't save the interior",
        isChecklistStepConflictError(error)
          ? "You may have an incomplete checklist already in progress. Check Settings > Checklist History to resume it."
          : (getApiErrorMessage(error) ?? "Please try again."),
      );
    }
  };

  return (
    <ChecklistShell
      currentStep={3}
      allowForward={!PRE_RIDE_STEP_LOCK_ENABLED}
      title="Interior & Dashboard"
      banner="Capture the dashboard clearly. We read the odometer and fuel level for you; check them, then continue."
      onStepPress={(step) => {
        if (activeTrackerId) {
          router.replace(
            getGuardedChecklistStepRoute({ flow: "preRide", requestedStep: step, summary: checklistSummary, trackerId: activeTrackerId }),
          );
        }
      }}
      footer={{
        children: checklistSummaryQuery.isError
          ? "Retry progress check"
          : isSubmitting
            ? "Saving..."
            : readings.isReadingPending
              ? "Reading dashboard..."
              : "Continue",
        loading: isSubmitting || readings.isReadingPending,
        disabled: stepGate.blocked || (!isNextEnabled && !checklistSummaryQuery.isError),
        onClick: () => {
          if (checklistSummaryQuery.isError) {
            void checklistSummaryQuery.refetch();
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
          onClick={() => void slots.capture({ key, label: `interior-${INTERIOR_IMAGE_TYPES[key]}` })}
          onRemove={() => void slots.remove(key)}
        />
      ))}

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
        <DashboardReadingNote trackerId={activeTrackerId || undefined} checklistType="PRE_TRIP" />
      )}

      <ChecklistSectionTitle className="mt-2">Vehicle Features</ChecklistSectionTitle>
      {!vehicleFeaturesQuery.isLoading && vehicleFeatures.length === 0 && (
        <p className="text-footnote mb-4 text-text-3">
          {vehicleFeaturesQuery.isError
            ? "Couldn't load this vehicle's features. Pull to refresh and try again."
            : "No features are listed for this vehicle."}
        </p>
      )}
      <FeatureChips
        features={vehicleFeatures}
        selectedIds={selectedFeatureIds}
        loading={vehicleFeaturesQuery.isLoading}
        onToggle={(id) =>
          setSelectedFeatureIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
        }
      />

      <ChecklistSectionTitle className="mt-4">Accessories Photo (Optional)</ChecklistSectionTitle>
      <PhotoUploadCard
        title="Accessories"
        subtitle={slots.subtitleFor("accessories", "Photo of available flashy accessories")}
        imageUri={slots.photos.accessories.localUri}
        uploading={slots.photos.accessories.status === "uploading"}
        failed={slots.photos.accessories.status === "failed"}
        onClick={() =>
          void slots.capture({
            key: "accessories",
            label: "accessories",
            beforeCapture: () => {
              if (selectedFeatureIds.length === 0) {
                toast.error("Select vehicle features", "Choose the features shown in the accessory photo first.");
                return false;
              }
              return true;
            },
          })
        }
        onRemove={() => void slots.remove("accessories")}
      />
    </ChecklistShell>
  );
}
