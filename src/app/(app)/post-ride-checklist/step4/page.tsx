"use client";

import { useState } from "react";
import { useStepGate } from "@/hooks/useStepGate";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, ChevronRight, Circle, Image as ImageIcon } from "lucide-react";

import { ChecklistShell } from "@/components/checklist/ChecklistShell";
import { BackButton } from "@/components/ui/BackButton";
import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import { usePostRideChecklistAggregate, useSubmitChecklist, useTodayChecklist } from "@/lib/api/hooks/usePreRideChecklist";
import { getChecklistStepRoute, getGuardedChecklistStepRoute } from "@/lib/utils/checklistNavigation";
import { POST_RIDE_STEP_LOCK_ENABLED } from "@/lib/utils/checklistNavigation";
import { useToast } from "@/providers/ToastProvider";

const formatValue = (value: number | undefined, suffix = "") => (value === undefined ? "Unavailable" : `${value}${suffix}`);

export default function PostRideStep4Page() {
  const router = useRouter();
  const toast = useToast();
  const activeTrackerId = useSearchParams().get("trackerId")?.trim() ?? "";
  const [isConfirmVisible, setConfirmVisible] = useState(false);
  const aggregateQuery = usePostRideChecklistAggregate(activeTrackerId);
  const submitChecklist = useSubmitChecklist();
  const todayChecklistQuery = useTodayChecklist();
  const aggregate = aggregateQuery.data?.data;
  const postTripSummary = aggregate?.postTripSummary;
  const metadata = postTripSummary?.interiorPhotos?.metadata ?? postTripSummary?.vehicleMetadata;

  const stepGate = useStepGate({
    aggregate: aggregate,
    flow: "postRide",
    isError: aggregateQuery.isError,
    isFetching: aggregateQuery.isFetching,
    onRecheck: () => void aggregateQuery.refetch(),
    step: 4,
    trackerId: activeTrackerId,
  });

  const exteriorDone = postTripSummary?.exteriorPhotos?.valid === true;
  const interiorDone = postTripSummary?.interiorPhotos?.valid === true;
  const allDone = exteriorDone && interiorDone;
  const openStep = (step: number) => router.push(getChecklistStepRoute("postRide", activeTrackerId, step));

  /** Submitting with a part missing goes to that part instead. */
  const trySubmit = () => {
    if (aggregateQuery.isError) {
      void aggregateQuery.refetch();
      return;
    }
    if (!allDone) {
      toast.error(
        exteriorDone ? "Interior not finished" : "Exterior photos not finished",
        "Finish this part first, then submit your report.",
      );
      openStep(exteriorDone ? 3 : 2);
      return;
    }
    setConfirmVisible(true);
  };

  const showSuccess = () => {
    toast.success("Post Ride Pilot Report submitted", "Your end-of-day report has been confirmed.");
    router.replace("/home");
  };

  const handleSubmit = async () => {
    setConfirmVisible(false);

    if (!activeTrackerId || submitChecklist.isPending) return;

    try {
      const confirmation = await submitChecklist.mutateAsync({ checklistType: "POST_TRIP", trackerId: activeTrackerId });

      if (confirmation.data.status !== "POST_RIDE_CLOSED") {
        throw new Error("The post-ride report was not confirmed. Please try again.");
      }

      showSuccess();
    } catch (error) {
      if (isChecklistStepConflictError(error)) {
        try {
          const todayResult = await todayChecklistQuery.refetch();
          const state = todayResult.data?.data.state ?? todayResult.data?.data.status;

          if (state === "DAY_ENDED") {
            showSuccess();
            return;
          }
        } catch {
          // keep original error
        }
      }
      toast.error("Report submission failed", getApiErrorMessage(error) ?? "Please try again.");
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
    <>
      <ChecklistShell
        currentStep={4}
        allowForward={!POST_RIDE_STEP_LOCK_ENABLED}
        stepLabels={["Vehicle", "Exterior", "Interior", "Submit"]}
        title="Review Report"
        onStepPress={(step) =>
          router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
        }
        footer={{
          children: aggregateQuery.isError
            ? "Retry progress check"
            : submitChecklist.isPending
              ? "Submitting..."
              : allDone
                ? "Submit Report"
                : !exteriorDone
                  ? "Finish Exterior Photos"
                  : "Finish Interior",
          loading: submitChecklist.isPending,
          disabled: stepGate.blocked || (!aggregateQuery.isError && (submitChecklist.isPending || (aggregateQuery.isLoading && !aggregate))),
          onClick: trySubmit,
        }}
      >
        {stepGate.notice}
        <p className="text-footnote mb-5 text-text-3">
          Confirm the end-of-day inspection after reviewing the captured photo totals and vehicle readings.
        </p>

        <div className="card mb-3 divide-y divide-separator p-0">
          {[
            { done: exteriorDone, step: 2, title: "Exterior Photos", count: postTripSummary?.exteriorPhotos?.photosCaptured ?? 0 },
            { done: interiorDone, step: 3, title: "Interior & Readings", count: postTripSummary?.interiorPhotos?.photosCaptured ?? 0 },
          ].map((part) => (
            <button
              key={part.step}
              type="button"
              onClick={() => openStep(part.step)}
              className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              {part.done ? <CheckCircle2 size={20} className="text-success" /> : <Circle size={20} className="text-warning-text" />}
              <span className="min-w-0 flex-1">
                <span className="text-body block font-semibold text-text">{part.title}</span>
                <span className="text-footnote block text-text-3">
                  {part.done ? `${part.count} photos saved` : "Not finished yet"}
                </span>
              </span>
              <ChevronRight size={18} className="text-text-4" />
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-footnote mb-3 flex items-center gap-2 font-semibold text-text">
              <Camera size={16} className="text-text-2" />
              Exterior photos
            </p>
            <p className="text-title-1 text-text">{postTripSummary?.exteriorPhotos?.photosCaptured ?? 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-footnote mb-3 flex items-center gap-2 font-semibold text-text">
              <ImageIcon size={16} className="text-text-2" />
              Interior photos
            </p>
            <p className="text-title-1 text-text">{postTripSummary?.interiorPhotos?.photosCaptured ?? 0}</p>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-footnote mb-4 font-semibold text-text">Vehicle readings</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption text-text-3">Odometer</p>
              <p className="text-headline text-text">{formatValue(metadata?.odometerKM, " km")}</p>
            </div>
            <div>
              <p className="text-caption text-text-3">Fuel level</p>
              <p className="text-headline text-text">{formatValue(metadata?.fuelLevelInPercentage, "%")}</p>
            </div>
          </div>
        </div>
      </ChecklistShell>

      <AlertDialog
        open={isConfirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={() => void handleSubmit()}
        title="Submit Report"
        message="Confirm this Post Ride Pilot Report and end your checklist for today?"
        confirmText="Submit"
      />
    </>
  );
}
