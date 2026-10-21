"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Image as ImageIcon } from "lucide-react";

import { ChecklistShell } from "@/components/checklist/ChecklistShell";
import { BackButton } from "@/components/ui/BackButton";
import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen } from "@/components/ui/Screen";
import { getApiErrorMessage, isChecklistStepConflictError } from "@/lib/api/errors";
import { usePostRideChecklistAggregate, useSubmitChecklist, useTodayChecklist } from "@/lib/api/hooks/usePreRideChecklist";
import { getChecklistStepRoute, getGuardedChecklistStepRoute, getPostRideGuardedStep } from "@/lib/utils/checklistNavigation";
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

  useEffect(() => {
    if (!activeTrackerId || aggregateQuery.isFetching || !aggregate) return;
    const guardedStep = getPostRideGuardedStep(4, aggregate);
    if (guardedStep !== 4) {
      router.replace(getChecklistStepRoute("postRide", activeTrackerId, guardedStep));
    }
  }, [activeTrackerId, aggregate, aggregateQuery.isFetching, router]);

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
        title="Review Report"
        onStepPress={(step) =>
          router.replace(getGuardedChecklistStepRoute({ aggregate, flow: "postRide", requestedStep: step, trackerId: activeTrackerId }))
        }
        footer={{
          children: aggregateQuery.isError ? "Retry progress check" : submitChecklist.isPending ? "Submitting..." : "Submit Report",
          loading: submitChecklist.isPending,
          disabled:
            !aggregateQuery.isError &&
            (submitChecklist.isPending || aggregateQuery.isLoading || getPostRideGuardedStep(4, aggregate) !== 4),
          onClick: () => {
            if (aggregateQuery.isError) {
              void aggregateQuery.refetch();
              return;
            }
            setConfirmVisible(true);
          },
        }}
      >
        <p className="text-footnote mb-5 text-text-3">
          Confirm the end-of-day inspection after reviewing the captured photo totals and vehicle readings.
        </p>

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
