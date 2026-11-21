"use client";

import { useRouter } from "next/navigation";

import { StepLockedNotice } from "@/components/checklist/StepLockedNotice";
import type { PostRideChecklistAggregate, PreRideChecklistSummary } from "@/lib/api/types";
import {
  getChecklistStepRoute,
  getPostRideGuardedStep,
  getPreRideGuardedStep,
  type ChecklistFlow,
} from "@/lib/utils/checklistNavigation";

const STEP_NAMES: Record<ChecklistFlow, string[]> = {
  postRide: ["Vehicle", "Exterior photos", "Interior", "Review"],
  preRide: ["Vehicle", "Exterior photos", "Interior", "Health"],
};

/**
 * Replaces the old "bounce back" when an earlier step is not saved yet. The
 * driver stays where they are, is told what is missing and can go to it (their
 * photos are kept on the phone) or check again. It only ever judges fresh,
 * successfully loaded progress, so a slow or failed fetch never sends anyone
 * anywhere. Does nothing while the step locks are off.
 */
export const useStepGate = ({
  aggregate,
  flow,
  isError,
  isFetching,
  onRecheck,
  step,
  summary,
  trackerId,
}: {
  aggregate?: PostRideChecklistAggregate;
  flow: ChecklistFlow;
  isError: boolean;
  isFetching: boolean;
  onRecheck: () => void;
  step: number;
  summary?: PreRideChecklistSummary;
  trackerId: string;
}) => {
  const router = useRouter();
  const hasProgress = flow === "preRide" ? Boolean(summary) : Boolean(aggregate);
  const settled = Boolean(trackerId) && hasProgress && !isFetching && !isError;
  const guardedStep = !settled
    ? step
    : flow === "preRide"
      ? getPreRideGuardedStep(step, summary)
      : getPostRideGuardedStep(step, aggregate);
  const blockedBy = guardedStep < step ? guardedStep : undefined;

  return {
    blocked: blockedBy !== undefined,
    notice:
      blockedBy !== undefined ? (
        <StepLockedNotice
          stepName={STEP_NAMES[flow][blockedBy - 1] ?? `Step ${blockedBy}`}
          onGo={() => router.push(getChecklistStepRoute(flow, trackerId, blockedBy))}
          onRecheck={onRecheck}
        />
      ) : null,
  };
};
