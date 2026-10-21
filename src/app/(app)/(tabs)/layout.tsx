import type { ReactNode } from "react";

import { TabBar } from "@/components/layout/TabBar";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
