"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDashed, Clock, Coffee, HeartPulse, Moon, Sun, type LucideIcon } from "lucide-react";

import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDriverSchedule } from "@/lib/api/hooks/useRideTimer";
import type { DriverScheduleDay } from "@/lib/api/types";
import { formatLagosDayMonth, formatWeekday, toLagosDate } from "@/lib/utils/lagosTime";

interface ShiftLook {
  title: string;
  detail: string;
  Icon: LucideIcon;
  /** iOS system colour. */
  tint: string;
  working: boolean;
}

/** How each kind of day reads, in iOS system colours. */
const lookFor = (day: DriverScheduleDay | undefined, scheduled: boolean): ShiftLook => {
  if (!day || !scheduled) {
    return { title: "Not Scheduled", detail: "Your Driver Manager hasn't set this week yet.", Icon: CircleDashed, tint: "#8E8E93", working: false };
  }
  if (day.sickLeave || day.shift === "SICK_LEAVE") {
    return { title: "Sick Leave", detail: "Rest up. You won't be given trips today.", Icon: HeartPulse, tint: "#FF3B30", working: false };
  }
  if (day.off || day.shift === "OFF_TIME" || day.shift === "NONE") {
    return { title: "Day Off", detail: "Working a trip today earns the off-day allowance.", Icon: Coffee, tint: "#34C759", working: false };
  }

  switch (day.shift) {
    case "DAY":
      return { title: "Day Shift", detail: "You're on for daytime trips.", Icon: Sun, tint: "#FF9500", working: true };
    case "NIGHT":
      return { title: "Night Shift", detail: "You're on for evening and night trips.", Icon: Moon, tint: "#5856D6", working: true };
    case "ALL_DAY":
      return { title: "All Day", detail: "You're on for trips at any time of day.", Icon: Clock, tint: "#007AFF", working: true };
    default:
      return { title: "Open", detail: "No shift set: you may get trips at any time.", Icon: CircleDashed, tint: "#8E8E93", working: true };
  }
};

const dayMonth = (date: string) => formatLagosDayMonth(date) ?? date;
const weekdayShort = (day: DriverScheduleDay) => formatWeekday(day.weekday).slice(0, 3);
const dayNumber = (date: string) => String(Number(date.slice(8, 10)));

/**
 * The driver's shifts, the Calendar way: the selected day in a large tinted
 * card, a week strip to pick a day, and the week at a glance.
 */
export default function MySchedulePage() {
  const scheduleQuery = useDriverSchedule(2);
  const weeks = useMemo(() => scheduleQuery.data?.data ?? [], [scheduleQuery.data]);
  const today = toLagosDate(new Date());
  const [weekIndex, setWeekIndex] = useState<"0" | "1">("0");
  const [selected, setSelected] = useState<string>(today);
  const pull = usePullToRefresh(async () => {
    await scheduleQuery.refetch();
  });

  const week = weeks[Number(weekIndex)] ?? weeks[0];
  const scheduled = week?.scheduled !== false;
  const selectedDay = week?.days.find((day) => day.date === selected) ?? week?.days[0];
  const look = lookFor(selectedDay, scheduled);
  const isToday = selectedDay?.date === today;

  // Open on today's week and day.
  useEffect(() => {
    const index = weeks.findIndex((candidate) => candidate.days.some((day) => day.date === today));

    if (index === 1) setWeekIndex("1");
  }, [today, weeks]);

  // Moving to the other week selects its first day (or today, if it's in it).
  useEffect(() => {
    if (!week) return;
    if (!week.days.some((day) => day.date === selected)) setSelected(week.days[0]?.date ?? today);
  }, [selected, today, week]);

  return (
    <Screen {...pull.bind}>
      {pull.indicator}
      <NavBar
        left={<BackButton href="/settings" label="Settings" />}
        largeTitle="My Schedule"
        subtitle="Your shifts for this week and next."
      />

      <div className="anim-fade-in px-5 pb-10 pt-1">
        {scheduleQuery.isLoading ? (
          <EmptyState loading title="Loading schedule" description="Fetching your shifts." />
        ) : scheduleQuery.isError ? (
          <EmptyState
            title="Unable to load your schedule"
            description={getApiErrorMessage(scheduleQuery.error) ?? "Please check your connection and try again."}
          />
        ) : weeks.length === 0 || !week ? (
          <EmptyState title="No schedule yet" description="Your Driver Manager hasn't set your shifts yet." />
        ) : (
          <>
            {weeks.length > 1 && (
              <div className="mb-4">
                <SegmentedControl
                  ariaLabel="Which week"
                  value={weekIndex}
                  onChange={setWeekIndex}
                  options={[
                    { label: "This Week", value: "0" as const },
                    { label: "Next Week", value: "1" as const },
                  ]}
                />
              </div>
            )}

            {/* The selected day */}
            {selectedDay && (
              <div
                key={selectedDay.date}
                className="anim-scale-in mb-5 rounded-[22px] p-5"
                style={{ backgroundColor: `${look.tint}1F` }}
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: look.tint }}>
                    {isToday ? "Today" : `${formatWeekday(selectedDay.weekday)} · ${dayMonth(selectedDay.date)}`}
                  </p>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ backgroundColor: look.tint }}>
                    <look.Icon size={22} />
                  </span>
                </div>
                <p className="mt-2 text-[30px] font-bold leading-9 tracking-tight text-text">{look.title}</p>
                <p className="mt-1 text-[15px] leading-5 text-text-2">{look.detail}</p>
              </div>
            )}

            {/* Week strip */}
            <div className="mb-6 grid grid-cols-7 gap-1.5" role="tablist" aria-label="Days of the week">
              {week.days.map((day) => {
                const dayLook = lookFor(day, scheduled);
                const isSelected = day.date === selectedDay?.date;

                return (
                  <button
                    key={day.date}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`${formatWeekday(day.weekday)} ${dayMonth(day.date)}, ${dayLook.title}`}
                    onClick={() => setSelected(day.date)}
                    className={`pressable flex flex-col items-center rounded-2xl py-2 transition-colors ${isSelected ? "bg-accent text-white" : "card"}`}
                  >
                    <span className={`text-[11px] font-medium ${isSelected ? "text-white/80" : "text-text-3"}`}>{weekdayShort(day)}</span>
                    <span className="mt-0.5 text-[17px] font-semibold tabular-nums">{dayNumber(day.date)}</span>
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? "#FFFFFF" : dayLook.tint, opacity: scheduled ? 1 : 0.4 }}
                    />
                  </button>
                );
              })}
            </div>

            {!scheduled && <p className="text-footnote mb-4 ml-1 text-warning-text">No schedule saved for this week yet.</p>}

            {/* The week at a glance */}
            <SectionHeader>
              {weekIndex === "0" ? "This week" : "Next week"} · {dayMonth(week.weekStartDate)}
              {week.days.length > 0 ? ` – ${dayMonth(week.days[week.days.length - 1].date)}` : ""}
            </SectionHeader>
            <div className="card overflow-hidden p-0">
              {week.days.map((day, index) => {
                const dayLook = lookFor(day, scheduled);

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelected(day.date)}
                    className="pressable flex w-full items-center gap-3 pl-4 text-left"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ backgroundColor: `${dayLook.tint}1F`, color: dayLook.tint }}
                    >
                      <dayLook.Icon size={17} />
                    </span>
                    <span className={`flex min-h-[56px] min-w-0 flex-1 items-center gap-2 py-2.5 pr-4 ${index < week.days.length - 1 ? "border-b border-border" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="text-body block font-medium text-text">
                          {formatWeekday(day.weekday)} <span className="font-normal text-text-3">{dayMonth(day.date)}</span>
                        </span>
                        <span className="text-footnote block text-text-3">{dayLook.title}</span>
                      </span>
                      {day.date === today && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent-text">Today</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
