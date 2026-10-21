"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getChecklistStepRoute } from "@/lib/utils/checklistNavigation";

/** Legacy route from the 6-step flow; the pre-ride checklist now ends at step 4. */
export default function ChecklistStep6Redirect() {
  const router = useRouter();
  const trackerId = useSearchParams().get("trackerId")?.trim() ?? "";

  useEffect(() => {
    router.replace(getChecklistStepRoute("preRide", trackerId, 4));
  }, [router, trackerId]);

  return null;
}
