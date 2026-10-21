"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";

export default function BecomeDriverSuccessPage() {
  const router = useRouter();

  return (
    <Screen className="safe-top px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div
          className="anim-scale-in mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-success text-white shadow-[0_12px_32px_-8px_rgba(18,183,106,0.6)]"
          style={{ animationTimingFunction: "var(--ease-spring-bounce)" }}
        >
          <Check size={44} strokeWidth={3} />
        </div>
        <h1 className="text-title-1 anim-rise-in mb-2 text-text">Success!</h1>
        <p className="text-body anim-rise-in max-w-xs text-text-2" style={{ animationDelay: "60ms" }}>
          Your application has been received and is currently being reviewed.
        </p>
      </div>
      <div className="pb-10">
        <Button onClick={() => router.replace("/login")}>Go to Login</Button>
      </div>
    </Screen>
  );
}
