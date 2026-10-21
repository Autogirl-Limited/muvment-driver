"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, X } from "lucide-react";

import { ChecklistSectionTitle, ChecklistShell } from "@/components/checklist/ChecklistShell";
import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { AlertDialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { usePhotoSlots } from "@/hooks/usePhotoSlot";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import {
  usePreRideChecklistSummary,
  useSubmitChecklist,
  useSubmitDriverPhotoChecklist,
  useSubmitVehicleHealthChecklist,
  useTodayChecklist,
} from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrips } from "@/lib/api/hooks/useTrips";
import type { VehicleHealthCheckPhoto } from "@/lib/api/types";
import { useChecklistMediaEntityId } from "@/lib/utils/checklistMediaEntity";
import { getChecklistStepRoute, getGuardedChecklistStepRoute, getPreRideGuardedStep } from "@/lib/utils/checklistNavigation";
import { isChecklistPhotoUploaded, toChecklistUploadedPhoto } from "@/lib/utils/checklistPhotos";
import { usePersistentIdempotencyKey } from "@/lib/utils/persistentIdempotencyKey";
import { useToast } from "@/providers/ToastProvider";

type HealthKey = "oilLevel" | "coolantLevel" | "safetyEquipment";

const HEALTH_KEYS: readonly HealthKey[] = ["oilLevel", "coolantLevel", "safetyEquipment"];
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
  const tripIdParam = searchParams.get("tripId")?.trim();
  const driverTripsQuery = useDriverTrips({ page: 0, size: 20 });
  const mediaEntityId = useChecklistMediaEntityId({
    trackerId: activeTrackerId,
    tripId: tripIdParam,
    trips: driverTripsQuery.data?.data.content ?? [],
  });
  const [isConfirmVisible, setConfirmVisible] = useState(false);
  const submitVehicleHealthChecklist = useSubmitVehicleHealthChecklist();
  const submitDriverPhotoChecklist = useSubmitDriverPhotoChecklist();
  const submitChecklist = useSubmitChecklist();
  const todayChecklistQuery = useTodayChecklist();
  const checklistSummaryQuery = usePreRideChecklistSummary(activeTrackerId);
  const checklistSummary = checklistSummaryQuery.data?.data;
  const vehicleHealthIdempotencyKey = usePersistentIdempotencyKey(`pre-trip-health-${activeTrackerId}`);
  const driverPhotoIdempotencyKey = usePersistentIdempotencyKey(`pre-trip-driver-${activeTrackerId}`);
  const health = usePhotoSlots(HEALTH_KEYS);
  const selfieSlot = usePhotoSlots(["selfie"] as const);
  const selfie = selfieSlot.photos.selfie;

  useEffect(() => {
    if (!activeTrackerId || checklistSummaryQuery.isFetching || !checklistSummary) return;
    const guardedStep = getPreRideGuardedStep(4, checklistSummary);
    if (guardedStep !== 4) {
      router.replace(getChecklistStepRoute("preRide", activeTrackerId, guardedStep));
    }
  }, [activeTrackerId, checklistSummary, checklistSummaryQuery.isFetching, router]);

  const hasSavedVehicleHealthChecklist = Boolean(checklistSummary?.vehicleHealthCheckPhotos?.valid);
  const hasSavedDriverPhotoChecklist = Boolean(checklistSummary?.driverPhoto?.valid);
  const hasPendingUpload = health.hasPendingUpload || selfieSlot.hasPendingUpload;
  const hasFailedUpload = health.hasFailedUpload || selfieSlot.hasFailedUpload;
  const isSubmitting = submitVehicleHealthChecklist.isPending || submitDriverPhotoChecklist.isPending || submitChecklist.isPending;
  const canSubmit =
    (hasSavedVehicleHealthChecklist || health.list.every(isChecklistPhotoUploaded)) &&
    (hasSavedDriverPhotoChecklist || isChecklistPhotoUploaded(selfie)) &&
    Boolean(activeTrackerId) &&
    Boolean(checklistSummary) &&
    !hasPendingUpload &&
    !hasFailedUpload &&
    !isSubmitting;

  const handleSubmit = async () => {
    setConfirmVisible(false);

    if (!activeTrackerId || !canSubmit) return;

    try {
      if (!hasSavedVehicleHealthChecklist) {
        try {
          await submitVehicleHealthChecklist.mutateAsync({
            idempotencyKey: vehicleHealthIdempotencyKey,
            payload: {
              checklistTrackerId: activeTrackerId,
              uploadPhotos: HEALTH_KEYS.map((key) => ({
                ...toChecklistUploadedPhoto(health.photos[key]),
                vehicleHealthCheckPhotos: HEALTH_PHOTO_TYPES[key],
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

      toast.success("Pre Ride Pilot Report submitted", "You are ready for your first ride today.");
      router.replace("/home");
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          const todayResult = await todayChecklistQuery.refetch();
          const state = todayResult.data?.data.state ?? todayResult.data?.data.status;

          if (state === "PRE_TRIP_COMPLETED" || state === "POST_TRIP_IN_PROGRESS" || state === "DAY_ENDED") {
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
    void selfieSlot.capture({ key: "selfie", label: "driver-selfie", entityId: mediaEntityId, facing: "user" });

  return (
    <>
      <ChecklistShell
        currentStep={4}
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
          disabled: !canSubmit && !checklistSummaryQuery.isError,
          onClick: () => {
            if (checklistSummaryQuery.isError) {
              void checklistSummaryQuery.refetch();
              return;
            }
            setConfirmVisible(true);
          },
        }}
      >
        <ChecklistSectionTitle>Vehicle Health Check</ChecklistSectionTitle>
        {HEALTH_KEYS.map((key) => (
          <PhotoUploadCard
            key={key}
            title={HEALTH_LABELS[key].title}
            subtitle={health.subtitleFor(key, HEALTH_LABELS[key].subtitle)}
            imageUri={health.photos[key].localUri}
            uploading={health.photos[key].status === "uploading"}
            failed={health.photos[key].status === "failed"}
            onClick={() => void health.capture({ key, label: `vehicle-health-${HEALTH_PHOTO_TYPES[key]}`, entityId: mediaEntityId })}
            onRemove={() => void health.remove(key)}
          />
        ))}

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
