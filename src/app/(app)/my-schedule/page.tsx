"use client";

import { Moon, Sun, SunMoon, Coffee } from "lucide-react";

import { Pill } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDriverSchedule } from "@/lib/api/hooks/useRideTimer";
import type { DriverScheduleDay, DriverShift } from "@/lib/api/types";
import { formatLagosDayMonth, formatWeekday, toLagosDate } from "@/lib/utils/lagosTime";

const SHIFT_LABELS: Record<DriverShift, string> = {
  DAY: "Day shift",
  NIGHT: "Night shift",
  ALL_DAY: "All day",
  NONE: "No shift",
};

const SHIFT_ICONS = { DAY: Sun, NIGHT: Moon, ALL_DAY: SunMoon, NONE: Coffee } as const;

const dayMonth = (date: string) => formatLagosDayMonth(date) ?? date;

const DayRow = ({ day, isToday }: { day: DriverScheduleDay; isToday: boolean }) => {
  const shift = day.off ? "NONE" : day.shift;
  const Icon = shift ? SHIFT_ICONS[shift] : Coffee;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${day.off ? "bg-success-soft" : ""}`}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
          day.off ? "bg-success text-white" : "bg-surface-alt text-text-2"
        }`}
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-body block font-medium text-text">
          {formatWeekday(day.weekday)} <span className="font-normal text-text-3">{dayMonth(day.date)}</span>
        </span>
        <span className={`text-footnote block ${day.off ? "text-success-text" : "text-text-3"}`}>
          {day.off ? "Counts for the off-day allowance if you work" : shift ? SHIFT_LABELS[shift] : "Not scheduled"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {isToday && <Pill tone="accent">Today</Pill>}
        {day.off && <Pill tone="success">Off day</Pill>}
      </span>
    </div>
  );
};

export default function MySchedulePage() {
  const scheduleQuery = useDriverSchedule(2);
  const weeks = scheduleQuery.data?.data ?? [];
  const today = toLagosDate(new Date());
  const pull = usePullToRefresh(async () => {
    await scheduleQuery.refetch();
  });

  return (
    <Screen {...pull.bind}>
      {pull.indicator}
      <NavBar left={<BackButton href="/settings" label="Settings" />} title="My schedule" />

      <div className="anim-fade-in px-5 pt-2 pb-10">
        <p className="text-footnote mb-5 text-text-3">
          Your shifts for this week and next. Working a trip on an off day earns the off-day allowance.
        </p>

        {scheduleQuery.isLoading ? (
          <EmptyState loading title="Loading schedule" description="Fetching your shifts." />
        ) : scheduleQuery.isError ? (
          <EmptyState
            title="Unable to load your schedule"
            description={getApiErrorMessage(scheduleQuery.error) ?? "Please check your connection and try again."}
          />
        ) : weeks.length === 0 ? (
          <EmptyState title="No schedule yet" description="Your Driver Manager hasn't set your shifts yet." />
        ) : (
          weeks.map((week, index) => (
            <section key={week.weekStartDate} className="mb-7">
              <SectionHeader>
                {index === 0 ? "This week" : index === 1 ? "Next week" : "Week"} · {dayMonth(week.weekStartDate)}
                {week.days.length > 0 ? ` – ${dayMonth(week.days[week.days.length - 1].date)}` : ""}
              </SectionHeader>
              {week.scheduled === false && (
                <p className="text-footnote mb-2 ml-1 text-warning-text">No schedule saved for this week yet.</p>
              )}
              <div className="inset-group [&>*+*]:border-t [&>*+*]:border-separator">
                {week.days.map((day) => (
                  <DayRow key={day.date} day={day} isToday={day.date === today} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </Screen>
  );
}
