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
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePostRideChecklistAggregate,
  useReanalyzeInteriorChecklist,
  useSubmitInteriorChecklist,
  useTodayChecklist,
  useUpdateInteriorMetadata,
  useVehicleFeatures,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { InteriorUploadImage, VehicleMetadata } from "@/lib/api/types";
import { getChecklistStepRoute, getGuardedChecklistStepRoute, getPostRideGuardedStep } from "@/lib/utils/checklistNavigation";
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
  const reanalyzeInteriorChecklist = useReanalyzeInteriorChecklist();
  const todayChecklistQuery = useTodayChecklist();
  const currentUserQuery = useCurrentUser();
  const vehicleFeaturesQuery = useVehicleFeatures(currentUserQuery.data?.data.vehicleId, { enabled: !currentUserQuery.isLoading });
  const aggregate = aggregateQuery.data?.data;
  const savedInteriorSummary = aggregate?.postTripSummary?.interiorPhotos;
  const savedMetadata = savedInteriorSummary?.metadata ?? aggregate?.postTripSummary?.vehicleMetadata;
  const hasSavedInteriorSubmission = savedInteriorSummary?.valid === true;
  const idempotencyKey = usePersistentIdempotencyKey(`post-trip-interior-${activeTrackerId}`);
  const slots = usePhotoSlots(INTERIOR_KEYS);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>();
  const [analysisMetadata, setAnalysisMetadata] = useState<VehicleMetadata | null>(null);
  const [isAnalysisReviewVisible, setAnalysisReviewVisible] = useState(false);
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const vehicleFeatures = vehicleFeaturesQuery.data?.data ?? [];

  useEffect(() => {
    if (!activeTrackerId || aggregateQuery.isFetching || !aggregate) return;
    const guardedStep = getPostRideGuardedStep(3, aggregate);
    if (guardedStep !== 3) {
      router.replace(getChecklistStepRoute("postRide", activeTrackerId, guardedStep));
    }
  }, [activeTrackerId, aggregate, aggregateQuery.isFetching, router]);

  const odometerKM = parseNumericInput(odometer);
  const fuelLevelInPercentage = parseNumericInput(fuelLevel);
  const hasValidMetadata = isMetadataValid(odometerKM, fuelLevelInPercentage);
  const hasDashboardUploaded = isChecklistPhotoUploaded(slots.photos.dashboard);
  const isSubmitting =
    submitInteriorChecklist.isPending || updateInteriorMetadata.isPending || reanalyzeInteriorChecklist.isPending;
  const isNextEnabled =
    Boolean(activeTrackerId) &&
    Boolean(aggregate) &&
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
    const response = await reanalyzeInteriorChecklist.mutateAsync({ checklistType: "POST_TRIP", trackerId: activeTrackerId });

    if (!showAnalysisReview(getInteriorAnalysisMetadata(response.data))) {
      throw new Error("Dashboard analysis did not return odometer and fuel readings. Please retake the dashboard photo.");
    }
  };

  const confirmAnalysis = async () => {
    if (odometerKM === undefined || fuelLevelInPercentage === undefined) return;

    await updateInteriorMetadata.mutateAsync({
      payload: { checklistTrackerId: activeTrackerId, checklistType: "POST_TRIP", fuelLevelInPercentage, odometerKM },
      trackerId: activeTrackerId,
    });
    router.push(getChecklistStepRoute("postRide", activeTrackerId, 4));
  };

  const recoverConflict = async () => {
    const result = await todayChecklistQuery.refetch();
    const today = result.data?.data;
    const recoveredInterior = today?.postTripSummary?.interiorPhotos;

    if (today?.checklistTrackerId?.trim() !== activeTrackerId || recoveredInterior?.valid !== true) {
      return false;
    }

    if (!showAnalysisReview(recoveredInterior.metadata ?? today.postTripSummary?.vehicleMetadata)) {
      await reanalyzeDashboard();
    }

    return true;
  };

  const handleNext = async () => {
    if (!activeTrackerId || !isNextEnabled) return;

    try {
      if (isAnalysisReviewVisible) {
        await confirmAnalysis();
        return;
      }
      if (hasSavedInteriorSubmission) {
        if (showAnalysisReview(savedMetadata)) return;
        await reanalyzeDashboard();
        return;
      }

      const accessoryPhoto = slots.photos.accessories;
      const accessoryUploadPhoto =
        isChecklistPhotoUploaded(accessoryPhoto) && selectedFeatureId
          ? { ...toChecklistUploadedPhoto(accessoryPhoto), interiorUploadImage: "ACCESSORIES" as const, publicCloudID: selectedFeatureId }
          : undefined;
      const response = await submitInteriorChecklist.mutateAsync({
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

      if (!showAnalysisReview(getInteriorAnalysisMetadata(response.data))) {
        await reanalyzeDashboard();
      }
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          if (await recoverConflict()) return;
        } catch {
          // keep original error
        }
      }
      toast.error(
        isAnalysisReviewVisible ? "Dashboard correction failed" : "Interior photos failed",
        getApiErrorMessage(error) ?? "Please try again.",
      );
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
      title="Interior Photos"
      banner="Capture the dashboard clearly. We will analyze the odometer and fuel readings before submission."
      onStepPress={(step) =>
        router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
      }
      footer={{
        children: aggregateQuery.isError
          ? "Retry progress check"
          : isSubmitting
            ? "Analyzing dashboard..."
            : isAnalysisReviewVisible
              ? "Confirm readings"
              : "Analyze dashboard",
        loading: isSubmitting,
        disabled: !isNextEnabled && !aggregateQuery.isError,
        onClick: () => {
          if (aggregateQuery.isError) {
            void aggregateQuery.refetch();
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

      {isAnalysisReviewVisible && analysisMetadata && (
        <AnalysisReviewCard metadata={analysisMetadata}>
          <ReadingsFields odometer={odometer} fuelLevel={fuelLevel} onOdometerChange={setOdometer} onFuelLevelChange={setFuelLevel} />
        </AnalysisReviewCard>
      )}
    </ChecklistShell>
  );
}
