"use client";

import { BrandAvatar } from "@/components/brand/BrandAvatar";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";

export const DashboardHeader = ({ title }: { title: string }) => (
  <header className="safe-top px-5">
    <div className="flex items-end justify-between pt-4 pb-4">
      <h1 className="text-large-title text-text">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationBellButton />
        <BrandAvatar />
      </div>
    </div>
  </header>
);
