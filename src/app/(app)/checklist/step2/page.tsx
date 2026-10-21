"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { usePhotoList, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePreRideChecklistSummary,
  useSubmitExteriorChecklist,
  useTodayChecklist,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrips } from "@/lib/api/hooks/useTrips";
import type { ExteriorUploadImage } from "@/lib/api/types";
import { useChecklistMediaEntityId } from "@/lib/utils/checklistMediaEntity";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideGuardedStep,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { usePersistentIdempotencyKey } from "@/lib/utils/persistentIdempotencyKey";
import { useToast } from "@/providers/ToastProvider";

type RequiredKey = "right" | "left" | "front" | "back";

const REQUIRED_KEYS: readonly RequiredKey[] = ["right", "left", "front", "back"];
const REQUIRED_IMAGE_TYPES: Record<RequiredKey, ExteriorUploadImage> = {
  back: "BACK",
  front: "FRONT",
  left: "LEFT_SIDE",
  right: "RIGHT_SIDE",
};
const REQUIRED_LABELS: Record<RequiredKey, { title: string; subtitle: string }> = {
  right: { title: "Right Side", subtitle: "Right Side: Full side including wheels" },
  left: { title: "Left Side", subtitle: "Left Side: Full side including wheels" },
  front: { title: "Front", subtitle: "Front: Clear view of grille and bumper" },
  back: { title: "Back", subtitle: "Back: Including taillights, bumper & plate" },
};

export default function ChecklistStep2Page() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() ?? "";
  const starterTripId = searchParams.get("tripId")?.trim() ?? "";
  const driverTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const mediaEntityId = useChecklistMediaEntityId({
    trackerId: activeTrackerId,
    tripId: starterTripId,
    trips: driverTripsQuery.data?.data.content ?? [],
  });
  const canAccessChecklist = Boolean(activeTrackerId || starterTripId || mediaEntityId);
  const idempotencyKey = usePersistentIdempotencyKey(
    `pre-ride-exterior-${activeTrackerId || starterTripId || mediaEntityId || "missing"}`,
  );
  const submitExteriorChecklist = useSubmitExteriorChecklist();
  const todayChecklistQuery = useTodayChecklist();
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId);
  const checklistSummary = checklistSummaryQuery.data?.data;
  const hasSavedExteriorChecklist = Boolean(checklistSummary?.exteriorPhotos?.valid);
  const required = usePhotoSlots(REQUIRED_KEYS);
  const damage = usePhotoList(3);

  useEffect(() => {
    if (!activeTrackerId || checklistSummaryQuery.isFetching || !checklistSummary) return;
    const guardedStep = getPreRideGuardedStep(2, checklistSummary);
    if (guardedStep !== 2) {
      router.replace(getChecklistStepRoute("preRide", activeTrackerId, guardedStep));
    }
  }, [activeTrackerId, checklistSummary, checklistSummaryQuery.isFetching, router]);

  const requiredList = required.list;
  const hasPendingUpload = required.hasPendingUpload || damage.hasPendingUpload;
  const hasFailedUpload = required.hasFailedUpload || damage.hasFailedUpload;
  const isSubmitting = submitExteriorChecklist.isPending;
  const isNextEnabled =
    (hasSavedExteriorChecklist || requiredList.every(isChecklistPhotoUploaded)) &&
    canAccessChecklist &&
    Boolean(mediaEntityId) &&
    (!activeTrackerId || Boolean(checklistSummary)) &&
    !hasPendingUpload &&
    !hasFailedUpload &&
    !isSubmitting;

  const recoverFromConflict = async () => {
    const result = await todayChecklistQuery.refetch();
    const recovered = result.data?.data;
    const recoveredTrackerId = activeTrackerId || recovered?.checklistTrackerId?.trim();

    if (!recoveredTrackerId || recovered?.preTripSummary?.exteriorPhotos?.valid !== true) {
      return false;
    }

    toast.success("Pilot Report recovered", "Continuing from the checklist already started today.");
    router.replace(getChecklistStepRoute("preRide", recoveredTrackerId, 3, { tripId: mediaEntityId }));
    return true;
  };

  const handleNext = async () => {
    if (!canAccessChecklist) {
      toast.error("Report unavailable", "Please go back and open the report again.");
      return;
    }
    if (!mediaEntityId) {
      toast.error("Trip not linked", driverTripsQuery.isError ? "Cannot load trips. Please refresh and try again." : "Open the pilot report from Home again.");
      return;
    }
    if (!isNextEnabled) {
      if (hasPendingUpload) toast.error("Upload in progress", "Wait for photos to finish uploading.");
      else if (hasFailedUpload) toast.error("Photo upload failed", "Retake or retry the failed photos.");
      else if (!hasSavedExteriorChecklist && !requiredList.every(isChecklistPhotoUploaded))
        toast.error("Exterior photos required", "Capture front, back, left, and right before continuing.");
      else if (activeTrackerId && !checklistSummary && !checklistSummaryQuery.isError)
        toast.error("Loading checklist", "Please wait a moment and try again.");
      return;
    }

    // Nothing freshly captured: skip straight ahead instead of re-submitting.
    if (activeTrackerId && hasSavedExteriorChecklist && !requiredList.some(isChecklistPhotoUploaded)) {
      router.push(getChecklistStepRoute("preRide", activeTrackerId, 3, { tripId: mediaEntityId }));
      return;
    }

    const uploadPhotos = [
      ...REQUIRED_KEYS.map((key) => ({
        ...toChecklistUploadedPhoto(required.photos[key]),
        exteriorUploadImage: REQUIRED_IMAGE_TYPES[key],
      })),
      ...damage.photos.filter(isChecklistPhotoUploaded).map((photo) => ({
        ...toChecklistUploadedPhoto(photo),
        exteriorUploadImage: "DAMAGE" as const,
      })),
    ];

    try {
      const response = await submitExteriorChecklist.mutateAsync({
        idempotencyKey,
        idempotencyScopeId: starterTripId,
        payload: {
          ...(activeTrackerId ? { checklistTrackerId: activeTrackerId } : {}),
          checklistType: "PRE_TRIP",
          uploadPhotos,
        },
        trackerId: activeTrackerId || undefined,
      });
      const resolvedTrackerId = activeTrackerId || response.data.checklistTrackerId?.trim();

      if (!resolvedTrackerId) {
        throw new Error("Checklist tracker was not returned after exterior upload.");
      }

      router.push(getChecklistStepRoute("preRide", resolvedTrackerId, 3, { tripId: mediaEntityId }));
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          if (await recoverFromConflict()) return;
        } catch {
          // fall through
        }
        toast.error(
          "Exterior photos failed",
          "You may have an incomplete checklist already in progress. Check Settings > Checklist History to resume it.",
        );
        return;
      }
      toast.error("Exterior photos failed", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  return (
    <ChecklistShell
      currentStep={2}
      title="Exterior Photos"
      banner="Capture all exterior angles before moving to the interior checklist."
      onStepPress={(step) => {
        if (activeTrackerId) {
          router.replace(
            getGuardedChecklistStepRoute({ flow: "preRide", requestedStep: step, summary: checklistSummary, trackerId: activeTrackerId }),
          );
          return;
        }
        if (starterTripId) router.replace(getPreRideStarterStepRoute(starterTripId, Math.min(step, 2)));
      }}
      footer={{
        children: checklistSummaryQuery.isError && activeTrackerId ? "Retry progress check" : isSubmitting ? "Saving..." : "Next",
        loading: isSubmitting,
        onClick: () => {
          if (checklistSummaryQuery.isError && activeTrackerId) {
            void checklistSummaryQuery.refetch();
            return;
          }
          void handleNext();
        },
      }}
    >
      {REQUIRED_KEYS.map((key) => (
        <PhotoUploadCard
          key={key}
          title={REQUIRED_LABELS[key].title}
          subtitle={required.subtitleFor(key, REQUIRED_LABELS[key].subtitle)}
          imageUri={required.photos[key].localUri}
          uploading={required.photos[key].status === "uploading"}
          failed={required.photos[key].status === "failed"}
          onClick={() => void required.capture({ key, label: `exterior-${REQUIRED_IMAGE_TYPES[key]}`, entityId: mediaEntityId })}
          onRemove={() => void required.remove(key)}
        />
      ))}

      <ChecklistSectionTitle className="mt-4">Damage Photos (Optional, Up to 3)</ChecklistSectionTitle>
      {damage.photos.map((photo, index) => (
        <PhotoUploadCard
          key={`damage-${index}`}
          title="Additional (Optional)"
          subtitle={damage.subtitleFor(photo, "Up to 3 damage close-ups")}
          imageUri={photo.localUri}
          uploading={photo.status === "uploading"}
          failed={photo.status === "failed"}
          onClick={() => void damage.retake(index, "exterior-damage", mediaEntityId)}
          onRemove={() => void damage.remove(index)}
        />
      ))}
      {damage.photos.length < 3 && (
        <PhotoUploadCard title="Add Damage" subtitle="Optional close-up of any damage" onClick={() => void damage.add("exterior-damage", mediaEntityId)} />
      )}
    </ChecklistShell>
  );
}
