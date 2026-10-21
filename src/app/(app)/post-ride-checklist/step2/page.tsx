"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { usePhotoList, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePostRideChecklistAggregate,
  useSubmitExteriorChecklist,
  useTodayChecklist,
} from "@/lib/api/hooks/usePreRideChecklist";
import type { ExteriorUploadImage } from "@/lib/api/types";
import { POST_RIDE_DAMAGE_CONFIG, POST_RIDE_EXTERIOR_PHOTOS } from "@/lib/data/tripTimeline";
import { getChecklistStepRoute, getGuardedChecklistStepRoute, getPostRideGuardedStep } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { usePersistentIdempotencyKey } from "@/lib/utils/persistentIdempotencyKey";
import { useToast } from "@/providers/ToastProvider";

type RequiredKey = (typeof POST_RIDE_EXTERIOR_PHOTOS)[number]["id"];

const REQUIRED_KEYS = POST_RIDE_EXTERIOR_PHOTOS.map((photo) => photo.id) as readonly RequiredKey[];
const REQUIRED_IMAGE_TYPES: Record<RequiredKey, ExteriorUploadImage> = {
  back: "BACK",
  front: "FRONT",
  leftSide: "LEFT_SIDE",
  rightSide: "RIGHT_SIDE",
};

export default function PostRideStep2Page() {
  const router = useRouter();
  const toast = useToast();
  const activeTrackerId = useSearchParams().get("trackerId")?.trim() ?? "";
  const submitExteriorChecklist = useSubmitExteriorChecklist();
  const aggregateQuery = usePostRideChecklistAggregate(activeTrackerId);
  const todayChecklistQuery = useTodayChecklist();
  const aggregate = aggregateQuery.data?.data;
  const hasSavedExteriorChecklist = aggregate?.postTripSummary?.exteriorPhotos?.valid === true;
  const idempotencyKey = usePersistentIdempotencyKey(`post-trip-exterior-${activeTrackerId}`);
  const required = usePhotoSlots(REQUIRED_KEYS);
  const damage = usePhotoList(POST_RIDE_DAMAGE_CONFIG.maxPhotos);

  useEffect(() => {
    if (!activeTrackerId || aggregateQuery.isFetching || !aggregate) return;
    const guardedStep = getPostRideGuardedStep(2, aggregate);
    if (guardedStep !== 2) {
      router.replace(getChecklistStepRoute("postRide", activeTrackerId, guardedStep));
    }
  }, [activeTrackerId, aggregate, aggregateQuery.isFetching, router]);

  const isNextEnabled =
    (hasSavedExteriorChecklist || required.list.every(isChecklistPhotoUploaded)) &&
    Boolean(activeTrackerId) &&
    Boolean(aggregate) &&
    !required.hasPendingUpload &&
    !damage.hasPendingUpload &&
    !required.hasFailedUpload &&
    !damage.hasFailedUpload &&
    !submitExteriorChecklist.isPending;

  const recoverConflict = async () => {
    const result = await todayChecklistQuery.refetch();
    const today = result.data?.data;

    if (today?.checklistTrackerId?.trim() !== activeTrackerId || today?.postTripSummary?.exteriorPhotos?.valid !== true) {
      return false;
    }

    router.replace(getChecklistStepRoute("postRide", activeTrackerId, 3));
    return true;
  };

  const handleNext = async () => {
    if (!activeTrackerId || !isNextEnabled) return;

    if (hasSavedExteriorChecklist) {
      router.push(getChecklistStepRoute("postRide", activeTrackerId, 3));
      return;
    }

    try {
      await submitExteriorChecklist.mutateAsync({
        idempotencyKey,
        payload: {
          checklistTrackerId: activeTrackerId,
          checklistType: "POST_TRIP",
          uploadPhotos: [
            ...REQUIRED_KEYS.map((key) => ({
              ...toChecklistUploadedPhoto(required.photos[key]),
              exteriorUploadImage: REQUIRED_IMAGE_TYPES[key],
            })),
            ...damage.photos.filter(isChecklistPhotoUploaded).map((photo) => ({
              ...toChecklistUploadedPhoto(photo),
              exteriorUploadImage: "DAMAGE" as const,
            })),
          ],
        },
        trackerId: activeTrackerId,
      });
      router.push(getChecklistStepRoute("postRide", activeTrackerId, 3));
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          if (await recoverConflict()) return;
        } catch {
          // keep original error
        }
      }
      toast.error("Exterior photos failed", getApiErrorMessage(error) ?? "Please try again.");
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
      currentStep={2}
      title="Exterior Photos"
      banner="Capture every side clearly before continuing to the interior inspection."
      onStepPress={(step) =>
        router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
      }
      footer={{
        children: aggregateQuery.isError ? "Retry progress check" : submitExteriorChecklist.isPending ? "Saving exterior..." : "Next",
        loading: submitExteriorChecklist.isPending,
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
      {POST_RIDE_EXTERIOR_PHOTOS.map((photo) => (
        <PhotoUploadCard
          key={photo.id}
          title={photo.title}
          subtitle={required.subtitleFor(photo.id, photo.subtitle)}
          imageUri={required.photos[photo.id].localUri}
          uploading={required.photos[photo.id].status === "uploading"}
          failed={required.photos[photo.id].status === "failed"}
          onClick={() =>
            void required.capture({ key: photo.id, label: `post-exterior-${REQUIRED_IMAGE_TYPES[photo.id]}`, entityId: activeTrackerId })
          }
          onRemove={() => void required.remove(photo.id)}
        />
      ))}

      <ChecklistSectionTitle className="mt-4">Damage Photos (Optional, Up to {POST_RIDE_DAMAGE_CONFIG.maxPhotos})</ChecklistSectionTitle>
      {damage.photos.map((photo, index) => (
        <PhotoUploadCard
          key={`damage-${index}`}
          title={POST_RIDE_DAMAGE_CONFIG.title}
          subtitle={damage.subtitleFor(photo, POST_RIDE_DAMAGE_CONFIG.subtitle)}
          imageUri={photo.localUri}
          uploading={photo.status === "uploading"}
          failed={photo.status === "failed"}
          onClick={() => void damage.retake(index, "post-exterior-damage", activeTrackerId)}
          onRemove={() => void damage.remove(index)}
        />
      ))}
      {damage.photos.length < POST_RIDE_DAMAGE_CONFIG.maxPhotos && (
        <PhotoUploadCard
          title={POST_RIDE_DAMAGE_CONFIG.title}
          subtitle={POST_RIDE_DAMAGE_CONFIG.subtitle}
          onClick={() => void damage.add("post-exterior-damage", activeTrackerId)}
        />
      )}
    </ChecklistShell>
  );
}
