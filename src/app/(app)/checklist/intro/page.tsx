"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CarFront, ClipboardCheck, Gauge, Wrench } from "lucide-react";

import { ReportIntro, type ReportIntroPart } from "@/components/checklist/ReportIntro";
import { BackButton } from "@/components/ui/BackButton";
import { Screen } from "@/components/ui/Screen";
import { getChecklistStepRoute, getPreRideStarterStepRoute } from "@/lib/utils/checklistNavigation";

const PRE_RIDE_PARTS: ReportIntroPart[] = [
  { icon: CarFront, tint: "#0A84FF", title: "Vehicle", detail: "Confirm the car you're driving today.", time: "15 sec" },
  { icon: CarFront, tint: "#30B0C7", title: "Exterior Photos", detail: "All four sides, plus any damage.", time: "1 min" },
  { icon: Gauge, tint: "#5E5CE6", title: "Interior & Readings", detail: "Dashboard, accessories, odometer and fuel.", time: "45 sec" },
  { icon: Wrench, tint: "#34C759", title: "Health & Selfie", detail: "Oil, coolant, safety gear and a quick selfie.", time: "1 min" },
];

const POST_RIDE_PARTS: ReportIntroPart[] = [
  { icon: CarFront, tint: "#0A84FF", title: "Vehicle", detail: "The car you drove today.", time: "10 sec" },
  { icon: CarFront, tint: "#30B0C7", title: "Exterior Photos", detail: "All four sides, plus any new damage.", time: "1 min" },
  { icon: Gauge, tint: "#5E5CE6", title: "Interior & Readings", detail: "Dashboard photo, odometer and fuel.", time: "45 sec" },
  { icon: ClipboardCheck, tint: "#34C759", title: "Review & Submit", detail: "Check your day, then end it.", time: "15 sec" },
];

function ReportIntroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPostRide = searchParams.get("flow") === "postRide";
  const trackerId = searchParams.get("trackerId")?.trim() || undefined;
  const isContinuing = Boolean(trackerId) && !isPostRide;

  const begin = () => {
    const firstStep = isPostRide
      ? getChecklistStepRoute("postRide", trackerId ?? "", 1)
      : trackerId
        ? getChecklistStepRoute("preRide", trackerId, 1)
        : getPreRideStarterStepRoute(1);

    // Replace, so Back from step 1 returns to Home rather than this page.
    router.replace(firstStep);
  };

  return (
    <Screen>
      <ReportIntro
        header={<BackButton label="Home" href="/home" />}
        eyebrow={isPostRide ? "Post-Ride Pilot Report" : "Pre-Ride Pilot Report"}
        totalTime={isPostRide ? "About 2 min" : "About 3 min"}
        title={isPostRide ? "Let's Wrap Up Your Day" : "Let's Check Your Car"}
        subtitle={
          isPostRide
            ? "A quick walk-around of the car you drove, so it's ready for tomorrow."
            : "Four quick parts and you're on the road. Have the car unlocked and the ignition on for the dashboard."
        }
        parts={isPostRide ? POST_RIDE_PARTS : PRE_RIDE_PARTS}
        beginTitle={isContinuing ? "Continue Your Report" : "Begin Your Report"}
        onBegin={begin}
      />
    </Screen>
  );
}

export default function ReportIntroPage() {
  return (
    <Suspense fallback={null}>
      <ReportIntroContent />
    </Suspense>
  );
}
