"use client";

import { useRouter } from "next/navigation";
import { Camera, ClipboardList, ListChecks, Send } from "lucide-react";

import { ReportIntro, type ReportIntroPart } from "@/components/checklist/ReportIntro";
import { BackButton } from "@/components/ui/BackButton";
import { Screen } from "@/components/ui/Screen";

const PARTS: ReportIntroPart[] = [
  { icon: ListChecks, tint: "#0A84FF", title: "Trip", detail: "Pick the trip it happened on.", time: "10 sec" },
  { icon: ClipboardList, tint: "#FF9F0A", title: "What Happened", detail: "Choose a category and describe it.", time: "1 min" },
  { icon: Camera, tint: "#5E5CE6", title: "Photo", detail: "Add a photo as evidence.", time: "20 sec" },
  { icon: Send, tint: "#34C759", title: "Send", detail: "It goes straight to the team.", time: "5 sec" },
];

export default function IncidentIntroPage() {
  const router = useRouter();

  return (
    <Screen>
      <ReportIntro
        header={<BackButton label="Back" href="/settings" />}
        eyebrow="Incident Report"
        totalTime="About 2 min"
        title="Report an Incident"
        subtitle="Tell us what happened on a trip. Your report is saved as you go, so you can finish it later."
        parts={PARTS}
        note="Your report is kept on this phone until you send it."
        beginTitle="Begin Report"
        onBegin={() => router.replace("/incident-report")}
      />
    </Screen>
  );
}
