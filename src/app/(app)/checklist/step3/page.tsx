"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import {
  AnalysisReviewCard,
  FeatureChips,
  getInteriorAnalysisMetadata,
  isMetadataValid,
  parseNumericInput,
  ReadingsFields,
} from "@/components/checklist/InteriorStep";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePreRideChecklistSummary,
  useReanalyzeInteriorChecklist,
  useSubmitInteriorChecklist,
  useUpdateInteriorMetadata,
  useVehicleFeatures,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrips } from "@/lib/api/hooks/useTrips";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { InteriorUploadImage, VehicleMetadata } from "@/lib/api/types";
import { useChecklistMediaEntityId } from "@/lib/utils/checklistMediaEntity";
import { getChecklistStepRoute, getGuardedChecklistStepRoute, getPreRideGuardedStep } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
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
  const tripIdParam = searchParams.get("tripId")?.trim();
  const driverTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const mediaEntityId = useChecklistMediaEntityId({
    trackerId: activeTrackerId,
    tripId: tripIdParam,
    trips: driverTripsQuery.data?.data.content ?? [],
  });
  const submitInteriorChecklist = useSubmitInteriorChecklist();
  const updateInteriorMetadata = useUpdateInteriorMetadata();
  const reanalyzeInteriorChecklist = useReanalyzeInteriorChecklist();
  const idempotencyKey = usePersistentIdempotencyKey(`pre-trip-interior-${activeTrackerId}`);
  const currentUserQuery = useCurrentUser();
  const vehicleFeaturesQuery = useVehicleFeatures(currentUserQuery.data?.data.vehicleId, { enabled: !currentUserQuery.isLoading });
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId);
  const checklistSummary = checklistSummaryQuery.data?.data;
  const savedMetadata = checklistSummary?.interiorPhotos?.metadata;
  const hasSavedInteriorSubmission = checklistSummary?.interiorPhotos?.valid === true;
  const slots = usePhotoSlots(INTERIOR_KEYS);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [analysisMetadata, setAnalysisMetadata] = useState<VehicleMetadata | null>(null);
  const [isAnalysisReviewVisible, setAnalysisReviewVisible] = useState(false);
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const vehicleFeatures = vehicleFeaturesQuery.data?.data ?? [];

  useEffect(() => {
    if (!activeTrackerId || checklistSummaryQuery.isFetching || !checklistSummary) return;
    const guardedStep = getPreRideGuardedStep(3, checklistSummary);
    if (guardedStep !== 3) {
      router.replace(getChecklistStepRoute("preRide", activeTrackerId, guardedStep));
    }
  }, [activeTrackerId, checklistSummary, checklistSummaryQuery.isFetching, router]);

  const odometerKM = parseNumericInput(odometer);
  const fuelLevelInPercentage = parseNumericInput(fuelLevel);
  const hasValidMetadata = isMetadataValid(odometerKM, fuelLevelInPercentage);
  const hasDashboardUploaded = isChecklistPhotoUploaded(slots.photos.dashboard);
  const isSubmitting =
    submitInteriorChecklist.isPending || reanalyzeInteriorChecklist.isPending || updateInteriorMetadata.isPending;
  const isNextEnabled =
    Boolean(activeTrackerId) &&
    Boolean(checklistSummary) &&
    (isAnalysisReviewVisible ? hasValidMetadata : hasSavedInteriorSubmission || hasDashboardUploaded) &&
    !slots.hasPendingUpload &&
    !slots.hasFailedUpload &&
    !isSubmitting;

  const showAnalysisReview = (metadata: VehicleMetadata | undefined) => {
    if (!metadata) return false;
    setAnalysisMetadata(metadata);
    setOdometer(typeof metadata.odometerKM === "number" ? String(metadata.odometerKM) : "");
    setFuelLevel(typeof metadata.fuelLevelInPercentage === "number" ? String(metadata.fuelLevelInPercentage) : "");
    setAnalysisReviewVisible(true);
    return true;
  };

  const reanalyzeDashboard = async () => {
    const response = await reanalyzeInteriorChecklist.mutateAsync({ checklistType: "PRE_TRIP", trackerId: activeTrackerId });

    if (!showAnalysisReview(getInteriorAnalysisMetadata(response.data))) {
      throw new Error("Dashboard analysis did not return odometer and fuel readings. Please retake the dashboard photo.");
    }
  };

  const confirmAnalysis = async () => {
    if (!activeTrackerId || !isNextEnabled || odometerKM === undefined || fuelLevelInPercentage === undefined) return;

    try {
      await updateInteriorMetadata.mutateAsync({
        payload: { checklistTrackerId: activeTrackerId, checklistType: "PRE_TRIP", fuelLevelInPercentage, odometerKM },
        trackerId: activeTrackerId,
      });
      router.push(getChecklistStepRoute("preRide", activeTrackerId, 4));
    } catch (error) {
      toast.error("Dashboard correction failed", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const handleNext = async () => {
    if (isAnalysisReviewVisible) {
      await confirmAnalysis();
      return;
    }
    if (!activeTrackerId) {
      toast.error("Report unavailable", "Please complete exterior photos first.");
      return;
    }
    if (hasSavedInteriorSubmission) {
      if (savedMetadata) {
        showAnalysisReview(savedMetadata);
        return;
      }
      try {
        await reanalyzeDashboard();
      } catch (error) {
        toast.error("Dashboard analysis failed", getApiErrorMessage(error) ?? "Please try again.");
      }
      return;
    }
    if (!isNextEnabled) return;

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
      const response = await submitInteriorChecklist.mutateAsync({
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

      if (showAnalysisReview(getInteriorAnalysisMetadata(response.data))) return;
      await reanalyzeDashboard();
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          const summaryResult = await checklistSummaryQuery.refetch();
          const recoveredInterior = summaryResult.data?.data.interiorPhotos;

          if (recoveredInterior?.valid && showAnalysisReview(recoveredInterior.metadata)) return;
          if (recoveredInterior?.valid) {
            await reanalyzeDashboard();
            return;
          }
        } catch {
          // fall through
        }
        toast.error(
          "Interior photos failed",
          "You may have an incomplete checklist already in progress. Check Settings > Checklist History to resume it.",
        );
        return;
      }
      toast.error("Interior photos failed", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  return (
    <ChecklistShell
      currentStep={3}
      title="Interior & Dashboard"
      banner="Capture the dashboard clearly. The odometer and fuel readings will be analyzed before the final step."
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
          : submitInteriorChecklist.isPending
            ? "Analyzing dashboard..."
            : isSubmitting
              ? "Saving..."
              : isAnalysisReviewVisible
                ? "Continue"
                : "Next",
        loading: isSubmitting,
        disabled: !isNextEnabled && !checklistSummaryQuery.isError,
        onClick: () => {
          if (checklistSummaryQuery.isError) {
            void checklistSummaryQuery.refetch();
            return;
          }
          void handleNext();
        },
      }}
    >
      {PHOTO_KEYS.map((key) => (
        <PhotoUploadCard
          key={key}
          title={INTERIOR_LABELS[key].title}
          subtitle={slots.subtitleFor(key, INTERIOR_LABELS[key].subtitle)}
          imageUri={slots.photos[key].localUri}
          uploading={slots.photos[key].status === "uploading"}
          failed={slots.photos[key].status === "failed"}
          onClick={() => void slots.capture({ key, label: `interior-${INTERIOR_IMAGE_TYPES[key]}`, entityId: mediaEntityId })}
          onRemove={() => void slots.remove(key)}
        />
      ))}

      <ChecklistSectionTitle className="mt-2">Vehicle Readings</ChecklistSectionTitle>
      <ReadingsFields odometer={odometer} fuelLevel={fuelLevel} onOdometerChange={setOdometer} onFuelLevelChange={setFuelLevel} />

      {isAnalysisReviewVisible && analysisMetadata && <AnalysisReviewCard metadata={analysisMetadata} />}

      {(vehicleFeatures.length > 0 || vehicleFeaturesQuery.isLoading) && (
        <ChecklistSectionTitle className="mt-2">Vehicle Features</ChecklistSectionTitle>
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
        subtitle={slots.subtitleFor("accessories", "Optional photo of available flashy accessories")}
        imageUri={slots.photos.accessories.localUri}
        uploading={slots.photos.accessories.status === "uploading"}
        failed={slots.photos.accessories.status === "failed"}
        onClick={() =>
          void slots.capture({
            key: "accessories",
            label: "accessories",
            entityId: mediaEntityId,
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
