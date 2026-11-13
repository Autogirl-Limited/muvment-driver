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
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { ExteriorUploadImage } from "@/lib/api/types";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideGuardedStep,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { toLagosDate } from "@/lib/utils/lagosTime";
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
  const currentUserQuery = useCurrentUser();
  const currentUserId = currentUserQuery.data?.data.userId?.trim() ?? "";
  const newChecklistScope = currentUserId ? `${currentUserId}-${toLagosDate(new Date())}` : "";
  const idempotencyKey = usePersistentIdempotencyKey(
    activeTrackerId
      ? `pre-ride-exterior-${activeTrackerId}`
      : newChecklistScope
        ? `pre-ride-exterior-${newChecklistScope}`
        : "",
  );
  const submitExteriorChecklist = useSubmitExteriorChecklist();
  const todayChecklistQuery = useTodayChecklist();
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId);
  const checklistSummary = checklistSummaryQuery.data?.data;
  const todayChecklistState = todayChecklistQuery.data?.data.state ?? todayChecklistQuery.data?.data.status;
  const canAccessChecklist = Boolean(activeTrackerId || todayChecklistState === "NOT_STARTED");
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
    Boolean(activeTrackerId || newChecklistScope) &&
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
    router.replace(getChecklistStepRoute("preRide", recoveredTrackerId, 3));
    return true;
  };

  const handleNext = async () => {
    if (!canAccessChecklist) {
      if (todayChecklistQuery.isFetching) {
        toast.error("Loading report", "Please wait a moment and try again.");
      } else if (todayChecklistQuery.isError) {
        toast.error("Report unavailable", "We could not verify today's report. Please check your connection and try again.");
      } else {
        toast.error("Report unavailable", "Today's report status has changed. Please reopen it from Home.");
      }
      return;
    }
    if (!isNextEnabled) {
      if (hasPendingUpload) toast.error("Upload in progress", "Wait for photos to finish uploading.");
      else if (hasFailedUpload) toast.error("Photo upload failed", "Retake or retry the failed photos.");
      else if (!hasSavedExteriorChecklist && !requiredList.every(isChecklistPhotoUploaded))
        toast.error("Exterior photos required", "Capture front, back, left, and right before continuing.");
      else if (activeTrackerId && !checklistSummary && !checklistSummaryQuery.isError)
        toast.error("Loading checklist", "Please wait a moment and try again.");
      else if (!activeTrackerId && !newChecklistScope)
        toast.error(
          "Driver profile unavailable",
          currentUserQuery.isError
            ? "We could not load your profile. Please check your connection and try again."
            : "Please wait a moment and try again.",
        );
      return;
    }

    // Nothing freshly captured: skip straight ahead instead of re-submitting.
    if (activeTrackerId && hasSavedExteriorChecklist && !requiredList.some(isChecklistPhotoUploaded)) {
      router.push(getChecklistStepRoute("preRide", activeTrackerId, 3));
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
        idempotencyScopeId: newChecklistScope,
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

      router.push(getChecklistStepRoute("preRide", resolvedTrackerId, 3));
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
        router.replace(getPreRideStarterStepRoute(Math.min(step, 2)));
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
          onClick={() => void required.capture({ key, label: `exterior-${REQUIRED_IMAGE_TYPES[key]}` })}
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
          onClick={() => void damage.retake(index, "exterior-damage")}
          onRemove={() => void damage.remove(index)}
        />
      ))}
      {damage.photos.length < 3 && (
        <PhotoUploadCard title="Add Damage" subtitle="Optional close-up of any damage" onClick={() => void damage.add("exterior-damage")} />
      )}
    </ChecklistShell>
  );
}
