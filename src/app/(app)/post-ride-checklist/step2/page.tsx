"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { PhotoInsightNote, SidePhotoCheck } from "@/components/checklist/AiPhotoNotes";
import { PhotoStepper, toShotTileState, type PhotoStep } from "@/components/checklist/PhotoStepper";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { useStepGate } from "@/hooks/useStepGate";
import { clearPhotoDraft, usePhotoList, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  submittedImagesFor,
  usePostRideChecklistAggregate,
  useSubmitExteriorChecklist,
  useSubmittedChecklistPhotos,
  useTodayChecklist,
} from "@/lib/api/hooks/usePreRideChecklist";
import type { ExteriorSide, ExteriorUploadImage } from "@/lib/api/types";
import { POST_RIDE_DAMAGE_CONFIG, POST_RIDE_EXTERIOR_PHOTOS } from "@/lib/data/tripTimeline";
import { getChecklistStepRoute, getGuardedChecklistStepRoute } from "@/lib/utils/checklistNavigation";
import { POST_RIDE_STEP_LOCK_ENABLED } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, pickSubmittedImages, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
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
  const [current, setCurrent] = useState(0);
  const required = usePhotoSlots(REQUIRED_KEYS, activeTrackerId ? `post-exterior:${activeTrackerId}` : undefined);
  const damage = usePhotoList(POST_RIDE_DAMAGE_CONFIG.maxPhotos, activeTrackerId ? `post-exterior-damage:${activeTrackerId}` : undefined);

  // Saved on another phone (or this one lost its copy): show what was submitted.
  const submittedQuery = useSubmittedChecklistPhotos(activeTrackerId || undefined, { enabled: hasSavedExteriorChecklist });
  const { restore: restoreRequired } = required;
  const { restore: restoreDamage } = damage;
  useEffect(() => {
    const images = submittedImagesFor(submittedQuery.data, "EXTERIOR", "POST_TRIP");
    if (images.length === 0) return;
    restoreRequired(pickSubmittedImages(images, REQUIRED_IMAGE_TYPES));
    restoreDamage(images.filter((image) => image.type === "DAMAGE"));
  }, [restoreDamage, restoreRequired, submittedQuery.data]);
  const photoSteps: PhotoStep[] = [
    ...POST_RIDE_EXTERIOR_PHOTOS.map((photo) => ({
      key: photo.id,
      label: photo.title.replace(" Side", ""),
      state: toShotTileState(required.photos[photo.id].status, hasSavedExteriorChecklist),
    })),
    {
      key: "damage",
      label: "Damage",
      optional: true,
      state: damage.photos.some(isChecklistPhotoUploaded) ? ("uploaded" as const) : damage.hasFailedUpload ? ("failed" as const) : ("empty" as const),
    },
  ];
  const isDamageStep = current === photoSteps.length - 1;

  const stepGate = useStepGate({
    aggregate: aggregate,
    flow: "postRide",
    isError: aggregateQuery.isError,
    isFetching: aggregateQuery.isFetching,
    onRecheck: () => void aggregateQuery.refetch(),
    step: 2,
    trackerId: activeTrackerId,
  });

  // Photos kept from an earlier try (the step was never saved) come back all at
  // once: open on the last screen so one tap sends them, instead of walking
  // through every photo again. Only on arrival, never mid-way through a fresh run.
  const resumedAtEnd = useRef(false);
  useEffect(() => {
    if (resumedAtEnd.current || hasSavedExteriorChecklist || current !== 0 || !required.list.every(isChecklistPhotoUploaded)) return;
    resumedAtEnd.current = true;
    setCurrent(photoSteps.length - 1);
  }, [current, hasSavedExteriorChecklist, photoSteps.length, required.list]);

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
      clearPhotoDraft(`post-exterior:${activeTrackerId}`);
      clearPhotoDraft(`post-exterior-damage:${activeTrackerId}`);
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
      allowForward={!POST_RIDE_STEP_LOCK_ENABLED}
      stepLabels={["Vehicle", "Exterior", "Interior", "Submit"]}
      title="Exterior Photos"
      banner="Capture every side clearly before continuing to the interior inspection."
      onStepPress={(step) =>
        router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
      }
      footer={{
        children: isDamageStep
          ? aggregateQuery.isError
            ? "Retry progress check"
            : submitExteriorChecklist.isPending
              ? "Saving exterior..."
              : "Next"
          : photoSteps[current].state === "uploading"
            ? "Uploading..."
            : "Next Photo",
        loading: isDamageStep ? submitExteriorChecklist.isPending : photoSteps[current].state === "uploading",
        disabled: stepGate.blocked || (isDamageStep ? !isNextEnabled && !aggregateQuery.isError : !["uploaded", "saved"].includes(photoSteps[current].state)),
        onClick: () => {
          if (!isDamageStep) {
            setCurrent((value) => Math.min(value + 1, photoSteps.length - 1));
            return;
          }
          if (aggregateQuery.isError) {
            void aggregateQuery.refetch();
            return;
          }
          void handleNext();
        },
      }}
    >
      {stepGate.notice}
      <PhotoStepper steps={photoSteps} current={current} onSelect={setCurrent} />

      <div key={photoSteps[current].key} className="anim-fade-in mt-5">
        {isDamageStep ? (
          <>
            <ChecklistSectionTitle>Damage Photos (Optional, Up to {POST_RIDE_DAMAGE_CONFIG.maxPhotos})</ChecklistSectionTitle>
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
                footer={<PhotoInsightNote imageUrl={photo.fileUrl} kind="DAMAGE" label="Damage close-up" checklistType="POST_TRIP" trackerId={activeTrackerId} />}
              />
            ))}
            {damage.photos.length < POST_RIDE_DAMAGE_CONFIG.maxPhotos && (
              <PhotoUploadCard
                title={POST_RIDE_DAMAGE_CONFIG.title}
                subtitle={POST_RIDE_DAMAGE_CONFIG.subtitle}
                onClick={() => void damage.add("post-exterior-damage", activeTrackerId)}
              />
            )}
            <p className="text-footnote mt-1 text-text-3">No new damage? Tap Next to continue.</p>
          </>
        ) : (
          (() => {
            const photo = POST_RIDE_EXTERIOR_PHOTOS[current];

            return (
              <>
                <ChecklistSectionTitle>{photo.title}</ChecklistSectionTitle>
                <PhotoUploadCard
                  title={photo.title}
                  subtitle={required.subtitleFor(photo.id, photo.subtitle)}
                  imageUri={required.photos[photo.id].localUri}
                  uploading={required.photos[photo.id].status === "uploading"}
                  failed={required.photos[photo.id].status === "failed"}
                  onClick={() =>
                    void required.capture({ key: photo.id, label: `post-exterior-${REQUIRED_IMAGE_TYPES[photo.id]}`, entityId: activeTrackerId })
                  }
                  onRemove={() => void required.remove(photo.id)}
                  footer={
                    <SidePhotoCheck
                      imageUrl={required.photos[photo.id].fileUrl}
                      side={REQUIRED_IMAGE_TYPES[photo.id] as ExteriorSide}
                      checklistType="POST_TRIP"
                      trackerId={activeTrackerId}
                    />
                  }
                />
                {hasSavedExteriorChecklist && !required.photos[photo.id].localUri && (
                  <p className="text-footnote mt-1 text-text-3">Already saved. Tap Next Photo to carry on, or take it again.</p>
                )}
              </>
            );
          })()
        )}
      </div>
    </ChecklistShell>
  );
}
