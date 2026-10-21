import { Suspense, type ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg">
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
