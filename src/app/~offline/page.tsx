"use client";

import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";

export default function OfflinePage() {
  return (
    <Screen className="safe-top items-center justify-center px-8 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-alt text-text-2">
        <WifiOff size={30} />
      </div>
      <h1 className="text-title-1 mb-2 text-text">You&apos;re offline</h1>
      <p className="text-body mb-8 max-w-xs text-text-2">
        This page isn&apos;t available without a connection. Reconnect and try again.
      </p>
      <Button fullWidth={false} onClick={() => window.location.reload()}>
        Try again
      </Button>
    </Screen>
  );
}
