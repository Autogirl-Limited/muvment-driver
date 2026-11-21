"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { PhotoInsightNote, SidePhotoCheck } from "@/components/checklist/AiPhotoNotes";
import { PhotoStepper, toShotTileState, type PhotoStep } from "@/components/checklist/PhotoStepper";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { useStepGate } from "@/hooks/useStepGate";
import { clearPhotoDraft, usePhotoList, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  useAssignedVehicle,
  usePreRideChecklistSummary,
  useSubmitExteriorChecklist,
  useTodayChecklist,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { ExteriorSide, ExteriorUploadImage } from "@/lib/api/types";
import {
  getChecklistStepRoute,
  getGuardedChecklistStepRoute,
  getPreRideStarterStepRoute,
} from "@/lib/utils/checklistNavigation";
import { PRE_RIDE_STEP_LOCK_ENABLED } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import type { ChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
import { readChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
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
  const [vehicleSelection, setVehicleSelection] = useState<ChecklistVehicleSelection>();
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
  const assignedVehicleQuery = useAssignedVehicle();
  const checklistSummary = checklistSummaryQuery.data?.data;
  const todayChecklistState = todayChecklistQuery.data?.data.state ?? todayChecklistQuery.data?.data.status;
  const canAccessChecklist = Boolean(activeTrackerId || todayChecklistState === "NOT_STARTED");
  const hasSavedExteriorChecklist = Boolean(checklistSummary?.exteriorPhotos?.valid);
  const [current, setCurrent] = useState(0);
  const draftScope = activeTrackerId || newChecklistScope;
  const required = usePhotoSlots(REQUIRED_KEYS, draftScope ? `exterior:${draftScope}` : undefined);
  const damage = usePhotoList(3, draftScope ? `exterior-damage:${draftScope}` : undefined);

  const stepOrder: Array<RequiredKey | "damage"> = [...REQUIRED_KEYS, "damage"];
  const photoSteps: PhotoStep[] = [
    ...REQUIRED_KEYS.map((key) => ({
      key,
      label: REQUIRED_LABELS[key].title.replace(" Side", ""),
      state: toShotTileState(required.photos[key].status, hasSavedExteriorChecklist),
    })),
    {
      key: "damage",
      label: "Damage",
      optional: true,
      state: damage.photos.some(isChecklistPhotoUploaded) ? ("uploaded" as const) : damage.hasFailedUpload ? ("failed" as const) : ("empty" as const),
    },
  ];
  const isDamageStep = current === stepOrder.length - 1;

  useEffect(() => {
    setVehicleSelection(readChecklistVehicleSelection(currentUserId));
  }, [currentUserId]);

  // A new report needs a vehicle: send the driver back to step 1, which explains why.
  useEffect(() => {
    if (activeTrackerId || !currentUserId) return;
    if (assignedVehicleQuery.isLoading || assignedVehicleQuery.isError) return;
    if (!assignedVehicleQuery.data && !readChecklistVehicleSelection(currentUserId)) {
      router.replace(getPreRideStarterStepRoute(1));
    }
  }, [activeTrackerId, assignedVehicleQuery.data, assignedVehicleQuery.isError, assignedVehicleQuery.isLoading, currentUserId, router]);

  const stepGate = useStepGate({
    summary: checklistSummary,
    flow: "preRide",
    isError: checklistSummaryQuery.isError,
    isFetching: checklistSummaryQuery.isFetching,
    onRecheck: () => void checklistSummaryQuery.refetch(),
    step: 2,
    trackerId: activeTrackerId,
  });

  // Photos kept from an earlier try (the step was never saved) come back all at
  // once: open on the last screen so one tap sends them, instead of walking
  // through every photo again. Only on arrival, never mid-way through a fresh run.
  const resumedAtEnd = useRef(false);
  useEffect(() => {
    if (resumedAtEnd.current || current !== 0 || !required.list.every(isChecklistPhotoUploaded)) return;
    resumedAtEnd.current = true;
    setCurrent(stepOrder.length - 1);
  }, [current, required.list, stepOrder.length]);

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
          ...(!activeTrackerId && vehicleSelection?.vehicle.id
            ? { vehicleId: vehicleSelection.vehicle.id }
            : {}),
        },
        trackerId: activeTrackerId || undefined,
      });
      const resolvedTrackerId = activeTrackerId || response.data.checklistTrackerId?.trim();

      if (!resolvedTrackerId) {
        throw new Error("Checklist tracker was not returned after exterior upload.");
      }

      clearPhotoDraft(draftScope ? `exterior:${draftScope}` : undefined);
      clearPhotoDraft(draftScope ? `exterior-damage:${draftScope}` : undefined);
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
      allowForward={!PRE_RIDE_STEP_LOCK_ENABLED}
      title="Exterior Photos"
      banner="Capture all exterior angles before moving to the interior checklist."
      onStepPress={(step) => {
        if (activeTrackerId) {
          router.replace(
            getGuardedChecklistStepRoute({ flow: "preRide", requestedStep: step, summary: checklistSummary, trackerId: activeTrackerId }),
          );
          return;
        }
        router.replace(getPreRideStarterStepRoute(PRE_RIDE_STEP_LOCK_ENABLED ? Math.min(step, 2) : step));
      }}
      footer={{
        children: isDamageStep
          ? checklistSummaryQuery.isError && activeTrackerId
            ? "Retry progress check"
            : isSubmitting
              ? "Saving..."
              : "Next"
          : photoSteps[current].state === "uploading"
            ? "Uploading..."
            : "Next Photo",
        loading: isDamageStep ? isSubmitting : photoSteps[current].state === "uploading",
        disabled: stepGate.blocked || (!isDamageStep && !["uploaded", "saved"].includes(photoSteps[current].state)),
        onClick: () => {
          if (!isDamageStep) {
            setCurrent((value) => Math.min(value + 1, stepOrder.length - 1));
            return;
          }
          if (checklistSummaryQuery.isError && activeTrackerId) {
            void checklistSummaryQuery.refetch();
            return;
          }
          void handleNext();
        },
      }}
    >
      {stepGate.notice}
      <PhotoStepper steps={photoSteps} current={current} onSelect={setCurrent} />

      <div key={stepOrder[current]} className="anim-fade-in mt-5">
        {isDamageStep ? (
          <>
            <ChecklistSectionTitle>Damage Photos (Optional, Up to 3)</ChecklistSectionTitle>
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
                footer={
                  <PhotoInsightNote
                    imageUrl={photo.fileUrl}
                    kind="DAMAGE"
                    label="Damage close-up"
                    checklistType="PRE_TRIP"
                    trackerId={activeTrackerId || undefined}
                  />
                }
              />
            ))}
            {damage.photos.length < 3 && (
              <PhotoUploadCard title="Add Damage" subtitle="Optional close-up of any damage" onClick={() => void damage.add("exterior-damage")} />
            )}
            <p className="text-footnote mt-1 text-text-3">No damage? Tap Next to continue.</p>
          </>
        ) : (
          (() => {
            const key = REQUIRED_KEYS[current];

            return (
              <>
                <ChecklistSectionTitle>{REQUIRED_LABELS[key].title}</ChecklistSectionTitle>
                <PhotoUploadCard
                  title={REQUIRED_LABELS[key].title}
                  subtitle={required.subtitleFor(key, REQUIRED_LABELS[key].subtitle)}
                  imageUri={required.photos[key].localUri}
                  uploading={required.photos[key].status === "uploading"}
                  failed={required.photos[key].status === "failed"}
                  onClick={() => void required.capture({ key, label: `exterior-${REQUIRED_IMAGE_TYPES[key]}` })}
                  onRemove={() => void required.remove(key)}
                  footer={
                    <SidePhotoCheck
                      imageUrl={required.photos[key].fileUrl}
                      side={REQUIRED_IMAGE_TYPES[key] as ExteriorSide}
                      checklistType="PRE_TRIP"
                      trackerId={activeTrackerId || undefined}
                      vehicleId={vehicleSelection?.vehicle.id ?? assignedVehicleQuery.data?.id}
                    />
                  }
                />
                {hasSavedExteriorChecklist && !required.photos[key].localUri && (
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
