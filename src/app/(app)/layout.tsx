import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      {/* Screens read search params on the client; Suspense satisfies the prerender bailout. */}
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
