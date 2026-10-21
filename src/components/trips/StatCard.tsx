import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  tone?: "default" | "warm";
}

export const StatCard = ({ title, value, icon, tone = "default" }: StatCardProps) => (
  <div
    className={`card flex flex-1 items-start justify-between p-4 ${
      tone === "warm" ? "bg-[#FFEDC6] dark:bg-[#3a2a10]" : ""
    }`}
  >
    <div>
      <p className="text-title-1 text-text">{value}</p>
      <p className="text-caption mt-1 font-medium text-text-2">{title}</p>
    </div>
    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-2">
      {icon}
    </span>
  </div>
);
