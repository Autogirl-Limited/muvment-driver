"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, X } from "lucide-react";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { PhotoInsightNote } from "@/components/checklist/AiPhotoNotes";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { AlertDialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { useStepGate } from "@/hooks/useStepGate";
import { clearPhotoDraft, usePhotoMap, usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePreRideChecklistSummary,
  useSubmitChecklist,
  useSubmitDriverPhotoChecklist,
  useSubmitVehicleHealthChecklist,
  useTodayChecklist,
  useVehicleFeatures,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useCurrentUser } from "@/lib/api/hooks/useUsers";
import type { PhotoInsightKind, VehicleFeature, VehicleHealthCheckPhoto } from "@/lib/api/types";
import { getChecklistStepRoute, getGuardedChecklistStepRoute } from "@/lib/utils/checklistNavigation";
import { PRE_RIDE_STEP_LOCK_ENABLED } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { clearChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";
import { usePersistentIdempotencyKey } from "@/lib/utils/persistentIdempotencyKey";
import { useToast } from "@/providers/ToastProvider";

type HealthKey = "oilLevel" | "coolantLevel" | "safetyEquipment";

const HEALTH_KEYS: readonly HealthKey[] = ["oilLevel", "coolantLevel", "safetyEquipment"];
const HEALTH_INSIGHT_KINDS: Record<HealthKey, PhotoInsightKind> = {
  coolantLevel: "COOLANT_LEVEL",
  oilLevel: "OIL_LEVEL",
  safetyEquipment: "SAFETY_EQUIPMENT",
};
const HEALTH_PHOTO_TYPES: Record<HealthKey, VehicleHealthCheckPhoto> = {
  coolantLevel: "COOLANT_LEVEL",
  oilLevel: "OIL_LEVEL",
  safetyEquipment: "SAFETY_EQUIPMENT",
};
const HEALTH_LABELS: Record<HealthKey, { title: string; subtitle: string }> = {
  oilLevel: { title: "Oil Level", subtitle: "Dipstick showing oil level between min/max" },
  coolantLevel: { title: "Coolant Level", subtitle: "Reservoir showing fluid level" },
  safetyEquipment: { title: "Safety Equipment", subtitle: "First Aid Kit, Warning Triangle, Fire Extinguisher" },
};
/** Shown if the Safety Equipment features can't be loaded (same as the mobile app). */
const FALLBACK_SAFETY_ITEMS: VehicleFeature[] = [
  { id: "first-aid-kit", name: "First Aid Kit", category: "SAFETY_EQUIPMENT", description: "Basic medical supplies for treating minor injuries on the road." },
  { id: "warning-triangle", name: "Warning Triangle", category: "SAFETY_EQUIPMENT", description: "Reflective triangle placed behind the car to warn traffic of a breakdown." },
  { id: "fire-extinguisher", name: "Fire Extinguisher", category: "SAFETY_EQUIPMENT", description: "Portable extinguisher for putting out a small fire in or around the car." },
];
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
const SELFIE_REQUIREMENTS = [
  "Face clearly visible and well-lit",
  "Uniform/professional attire visible",
  "No sunglasses or face coverings",
  "Good lighting on your face",
];

export default function ChecklistStep4Page() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const activeTrackerId = searchParams.get("trackerId")?.trim() ?? "";
  const currentUserQuery = useCurrentUser();
  const [isConfirmVisible, setConfirmVisible] = useState(false);
  const submitVehicleHealthChecklist = useSubmitVehicleHealthChecklist();
  const submitDriverPhotoChecklist = useSubmitDriverPhotoChecklist();
  const submitChecklist = useSubmitChecklist();
  const todayChecklistQuery = useTodayChecklist();
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId);
  const checklistSummary = checklistSummaryQuery.data?.data;
  const vehicleHealthIdempotencyKey = usePersistentIdempotencyKey(`pre-trip-health-${activeTrackerId}`);
  const driverPhotoIdempotencyKey = usePersistentIdempotencyKey(`pre-trip-driver-${activeTrackerId}`);
  const health = usePhotoSlots(HEALTH_KEYS, activeTrackerId ? `health:${activeTrackerId}` : undefined);
  const selfieSlot = usePhotoSlots(["selfie"] as const, activeTrackerId ? `selfie:${activeTrackerId}` : undefined);
  const selfie = selfieSlot.photos.selfie;

  // The safety items to photograph come from the vehicle feature catalogue.
  const vehicleFeaturesQuery = useVehicleFeatures(undefined);
  const loadedSafetyItems = (vehicleFeaturesQuery.data?.data ?? [])
    .filter((feature) => feature.category === "SAFETY_EQUIPMENT")
    .sort((a, b) => a.name.localeCompare(b.name));
  const safetyItems = loadedSafetyItems.length > 0 ? loadedSafetyItems : FALLBACK_SAFETY_ITEMS;
  // Optional: one photo per safety item, instead of (or as well as) the group photo.
  const safetyItemSlots = usePhotoMap(activeTrackerId ? `safety-items:${activeTrackerId}` : undefined);
  const safetyItemPhotoList = safetyItems.flatMap((item) => (safetyItemSlots.photos[item.id] ? [safetyItemSlots.photos[item.id]] : []));
  const safetyItemsDone = safetyItems.filter((item) => {
    const photo = safetyItemSlots.photos[item.id];
    return photo ? isChecklistPhotoUploaded(photo) : false;
  }).length;
  /** Safety is covered by the group photo, or by a photo of every item. */
  const isSafetyCovered =
    isChecklistPhotoUploaded(health.photos.safetyEquipment) ||
    (safetyItems.length > 0 && safetyItemsDone === safetyItems.length);

  const stepGate = useStepGate({
    summary: checklistSummary,
    flow: "preRide",
    isError: checklistSummaryQuery.isError,
    isFetching: checklistSummaryQuery.isFetching,
    onRecheck: () => void checklistSummaryQuery.refetch(),
    step: 4,
    trackerId: activeTrackerId,
  });

  const hasSavedVehicleHealthChecklist = Boolean(checklistSummary?.vehicleHealthCheckPhotos?.valid);
  const hasSavedDriverPhotoChecklist = Boolean(checklistSummary?.driverPhoto?.valid);
  const hasPendingUpload = health.hasPendingUpload || selfieSlot.hasPendingUpload || safetyItemSlots.hasPendingUpload;
  const hasFailedUpload = health.hasFailedUpload || selfieSlot.hasFailedUpload || safetyItemSlots.hasFailedUpload;
  const isSubmitting = submitVehicleHealthChecklist.isPending || submitDriverPhotoChecklist.isPending || submitChecklist.isPending;
  const canSubmit =
    (hasSavedVehicleHealthChecklist ||
      (isChecklistPhotoUploaded(health.photos.oilLevel) &&
        isChecklistPhotoUploaded(health.photos.coolantLevel) &&
        isSafetyCovered)) &&
    (hasSavedDriverPhotoChecklist || isChecklistPhotoUploaded(selfie)) &&
    Boolean(activeTrackerId) &&
    Boolean(checklistSummary) &&
    !hasPendingUpload &&
    !hasFailedUpload &&
    !isSubmitting;

  const handleSubmit = async () => {
    setConfirmVisible(false);

    if (!activeTrackerId || !canSubmit) return;

    // Steps are not locked, so a part may have been skipped: go to it instead of submitting.
    const missingStep = !checklistSummary?.exteriorPhotos?.valid ? 2 : !checklistSummary?.interiorPhotos?.valid ? 3 : undefined;

    if (missingStep) {
      toast.error(
        missingStep === 2 ? "Exterior photos not finished" : "Interior not finished",
        "Finish this part first, then submit your report.",
      );
      router.push(getChecklistStepRoute("preRide", activeTrackerId, missingStep));
      return;
    }

    try {
      if (!hasSavedVehicleHealthChecklist) {
        try {
          await submitVehicleHealthChecklist.mutateAsync({
            idempotencyKey: vehicleHealthIdempotencyKey,
            payload: {
              checklistTrackerId: activeTrackerId,
              // Oil and coolant, then every safety photo: the group photo and/or
              // one per item, all sent as SAFETY_EQUIPMENT.
              uploadPhotos: [
                ...HEALTH_KEYS.map((key) => ({ photo: health.photos[key], type: HEALTH_PHOTO_TYPES[key] })),
                ...safetyItemPhotoList.map((photo) => ({ photo, type: HEALTH_PHOTO_TYPES.safetyEquipment })),
              ]
                .filter(({ photo }) => isChecklistPhotoUploaded(photo))
                .map(({ photo, type }) => ({
                  ...toChecklistUploadedPhoto(photo),
                  vehicleHealthCheckPhotos: type,
                })),
            },
            trackerId: activeTrackerId,
          });
        } catch (error) {
          if (!isChecklistStepConflictError(error)) throw error;
          const recovered = await checklistSummaryQuery.refetch();
          if (recovered.data?.data.vehicleHealthCheckPhotos?.valid !== true) throw error;
        }
      }

      if (!hasSavedDriverPhotoChecklist) {
        try {
          await submitDriverPhotoChecklist.mutateAsync({
            idempotencyKey: driverPhotoIdempotencyKey,
            payload: { checklistTrackerId: activeTrackerId, uploadPhotos: [toChecklistUploadedPhoto(selfie)] },
            trackerId: activeTrackerId,
          });
        } catch (error) {
          if (!isChecklistStepConflictError(error)) throw error;
          const recovered = await checklistSummaryQuery.refetch();
          if (recovered.data?.data.driverPhoto?.valid !== true) throw error;
        }
      }

      const confirmation = await submitChecklist.mutateAsync({ checklistType: "PRE_TRIP", trackerId: activeTrackerId });

      if (confirmation.data.status !== "PRE_RIDE_CLOSED") {
        throw new Error("The pre-ride report was not confirmed. Please try again.");
      }

      clearPhotoDraft(`health:${activeTrackerId}`);
      clearPhotoDraft(`safety-items:${activeTrackerId}`);
      clearPhotoDraft(`selfie:${activeTrackerId}`);
      toast.success("Pre Ride Pilot Report submitted", "You are ready for your first ride today.");
      clearChecklistVehicleSelection(currentUserQuery.data?.data.userId);
      router.replace("/home");
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          const todayResult = await todayChecklistQuery.refetch();
          const state = todayResult.data?.data.state ?? todayResult.data?.data.status;

          if (state === "PRE_TRIP_COMPLETED" || state === "POST_TRIP_IN_PROGRESS" || state === "DAY_ENDED") {
            clearChecklistVehicleSelection(currentUserQuery.data?.data.userId);
            router.replace("/home");
            return;
          }
        } catch {
          // keep the original error
        }
      }
      toast.error(
        "Report submission failed",
        isChecklistStepConflictError(error)
          ? "You may have an incomplete checklist already in progress. Check Settings > Checklist History to resume it."
          : (getApiErrorMessage(error) ?? "Please try again."),
      );
    }
  };

  const openCamera = () =>
    void selfieSlot.capture({ key: "selfie", label: "driver-selfie", facing: "user" });

  return (
    <>
      <ChecklistShell
        currentStep={4}
        allowForward={!PRE_RIDE_STEP_LOCK_ENABLED}
        title="Health, Driver Photo & Submit"
        banner="Complete the vehicle health photos and driver photo, then submit your report."
        onStepPress={(step) => {
          if (activeTrackerId) {
            router.replace(
              getGuardedChecklistStepRoute({ flow: "preRide", requestedStep: step, summary: checklistSummary, trackerId: activeTrackerId }),
            );
          }
        }}
        footer={{
          children: checklistSummaryQuery.isError ? "Retry progress check" : isSubmitting ? "Submitting..." : "Submit Report",
          loading: isSubmitting,
          disabled: stepGate.blocked || (!canSubmit && !checklistSummaryQuery.isError),
          onClick: () => {
            if (checklistSummaryQuery.isError) {
              void checklistSummaryQuery.refetch();
              return;
            }
            setConfirmVisible(true);
          },
        }}
      >
        {stepGate.notice}
        <ChecklistSectionTitle>Vehicle Health Check</ChecklistSectionTitle>
        {HEALTH_KEYS.map((key) => (
          <PhotoUploadCard
            key={key}
            title={HEALTH_LABELS[key].title}
            subtitle={health.subtitleFor(
              key,
              key === "safetyEquipment"
                ? `${joinNames(safetyItems.map((item) => item.name))} in one photo`
                : HEALTH_LABELS[key].subtitle,
            )}
            imageUri={health.photos[key].localUri}
            uploading={health.photos[key].status === "uploading"}
            failed={health.photos[key].status === "failed"}
            onClick={() => void health.capture({ key, label: `vehicle-health-${HEALTH_PHOTO_TYPES[key]}` })}
            onRemove={() => void health.remove(key)}
            footer={
              <PhotoInsightNote
                imageUrl={health.photos[key].fileUrl}
                kind={HEALTH_INSIGHT_KINDS[key]}
                label={HEALTH_LABELS[key].title}
                checklistType="PRE_TRIP"
                trackerId={activeTrackerId}
              />
            }
          />
        ))}

        <ChecklistSectionTitle className="mt-2">Safety Items</ChecklistSectionTitle>
        <p className="text-footnote mb-3 text-text-3">
          {isSafetyCovered
            ? "Safety equipment is covered."
            : safetyItemsDone > 0
              ? `Photograph the remaining ${safetyItems.length - safetyItemsDone === 1 ? "item" : "items"}, or take one group photo above.`
              : "Photograph every item here, or take one group photo above."}
          {safetyItemsDone > 0 && ` ${safetyItemsDone} of ${safetyItems.length} photographed.`}
        </p>
        {vehicleFeaturesQuery.isLoading ? (
          <p className="text-footnote mb-4 flex items-center gap-2 text-text-3">
            <Spinner size={14} /> Loading safety items...
          </p>
        ) : (
          safetyItems.map((item) => {
            const photo = safetyItemSlots.photos[item.id];

            return (
              <PhotoUploadCard
                key={item.id}
                title={item.name}
                subtitle={safetyItemSlots.subtitleFor(
                  item.id,
                  item.description?.trim() || `Show the ${item.name.toLowerCase()} clearly`,
                )}
                imageUri={photo?.localUri}
                uploading={photo?.status === "uploading"}
                failed={photo?.status === "failed"}
                onClick={() => void safetyItemSlots.capture(item.id, `vehicle-health-${HEALTH_PHOTO_TYPES.safetyEquipment}`)}
                onRemove={() => void safetyItemSlots.remove(item.id)}
                footer={
                  photo ? (
                    <PhotoInsightNote
                      imageUrl={photo.fileUrl}
                      kind="SAFETY_EQUIPMENT"
                      label={item.name}
                      checklistType="PRE_TRIP"
                      trackerId={activeTrackerId}
                    />
                  ) : undefined
                }
              />
            );
          })
        )}

        <ChecklistSectionTitle className="mt-6">Driver Photo</ChecklistSectionTitle>
        <ol className="mb-5 space-y-2">
          {SELFIE_REQUIREMENTS.map((requirement, index) => (
            <li key={requirement} className="text-callout flex items-center gap-3 text-text-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-alt text-[12px] font-semibold text-text">
                {index + 1}
              </span>
              {requirement}
            </li>
          ))}
        </ol>

        {selfie.localUri ? (
          <div
            className={`relative mb-6 h-[340px] overflow-hidden rounded-2xl border-2 bg-black ${
              selfie.status === "failed" ? "border-danger" : "border-accent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selfie.localUri} alt="Driver selfie" className="h-full w-full object-cover opacity-90" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="h-48 w-48 rounded-full border-2 border-dashed border-white/60" />
            </div>
            {selfie.status === "uploading" && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-2 text-white">
                <Spinner size={16} />
                <span className="text-footnote">Uploading...</span>
              </div>
            )}
            {selfie.status === "failed" && (
              <button type="button" onClick={openCamera} className="absolute inset-x-0 bottom-0 bg-danger/90 py-2 text-center text-[13px] font-medium text-white">
                Upload failed. Tap to retry.
              </button>
            )}
            <button
              type="button"
              onClick={() => void selfieSlot.remove("selfie")}
              className="pressable-soft absolute top-3 right-3 rounded-full bg-black/45 p-2 text-white"
              aria-label="Remove selfie"
            >
              <X size={22} />
            </button>
          </div>
        ) : (
          <div className="mb-6 flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface py-10">
            <div className="mb-6 flex h-40 w-40 items-center justify-center rounded-full border border-dashed border-border-strong bg-surface-alt text-text-2 shadow-card">
              <Camera size={26} />
            </div>
            <p className="text-callout mb-6 px-4 text-center text-text-2">Position your face within the circle</p>
            <button
              type="button"
              onClick={openCamera}
              className="pressable inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[14px] font-semibold text-white"
            >
              <Camera size={18} />
              Open Camera
            </button>
          </div>
        )}
        {selfie.status === "uploaded" && (
          <div className="-mt-3 mb-6">
            <PhotoInsightNote
              imageUrl={selfie.fileUrl}
              kind="DRIVER_SELFIE"
              label="Driver selfie"
              checklistType="PRE_TRIP"
              trackerId={activeTrackerId}
            />
          </div>
        )}
      </ChecklistShell>

      <AlertDialog
        open={isConfirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={() => void handleSubmit()}
        title="Submit Report"
        message="Are you sure you want to submit this Pre Ride Pilot Report? This action cannot be undone."
        confirmText="Submit"
      />
    </>
  );
}
