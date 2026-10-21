"use client";

import { Button, type ButtonProps } from "@/components/ui/Button";

/** Sticky, translucent action bar at the bottom of every checklist step. */
export const ChecklistFooter = (props: ButtonProps) => (
  <div
    className="glass sticky bottom-0 z-20 -mx-0 mt-auto border-t px-6 pt-4"
    style={{ paddingBottom: "calc(var(--safe-bottom) + 20px)" }}
  >
    <Button {...props} />
  </div>
);

export const Banner = ({ children, tone = "danger" }: { children: React.ReactNode; tone?: "danger" | "info" }) => (
  <div
    className={`text-footnote mb-5 px-5 py-3 font-medium ${
      tone === "danger" ? "bg-[#E32636] text-white" : "bg-accent-soft text-accent-text"
    }`}
  >
    {children}
  </div>
);
