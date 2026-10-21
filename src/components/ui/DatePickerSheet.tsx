"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Sheet } from "./Dialog";

interface DatePickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
}

const DAYS_OF_WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export const DatePickerSheet = ({ open, onClose, onSelectDate }: DatePickerSheetProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pickerMode, setPickerMode] = useState<"calendar" | "month" | "year">("calendar");
  const [yearPageStart, setYearPageStart] = useState(() => {
    const year = new Date().getFullYear();
    return year - (year % 12);
  });

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(2026, month, 1)),
      ),
    [],
  );
  const years = Array.from({ length: 12 }, (_, index) => yearPageStart + index);

  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const grid: { day: number; isCurrentMonth: boolean; fullDate: Date }[] = [];

    for (let i = 0; i < startDay; i++) {
      const day = daysInPrevMonth - startDay + i + 1;
      grid.push({ day, isCurrentMonth: false, fullDate: new Date(year, month - 1, day) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({ day: i, isCurrentMonth: true, fullDate: new Date(year, month, i) });
    }
    const remaining = 42 - grid.length;
    for (let i = 1; i <= remaining; i++) {
      grid.push({ day: i, isCurrentMonth: false, fullDate: new Date(year, month + 1, i) });
    }

    return grid;
  }, [currentMonth]);

  const handlePrev = () => {
    if (pickerMode === "year") {
      setYearPageStart((prev) => prev - 12);
      return;
    }
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNext = () => {
    if (pickerMode === "year") {
      setYearPageStart((prev) => prev + 12);
      return;
    }
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleHeaderPress = () => {
    setPickerMode((mode) => {
      if (mode === "calendar") return "month";
      if (mode === "month") {
        setYearPageStart(currentMonth.getFullYear() - (currentMonth.getFullYear() % 12));
        return "year";
      }
      return "calendar";
    });
  };

  const displayedTitle =
    pickerMode === "calendar"
      ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(currentMonth)
      : pickerMode === "month"
        ? String(currentMonth.getFullYear())
        : `${yearPageStart} - ${yearPageStart + 11}`;

  const today = new Date().toDateString();

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Pick a date">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={handleHeaderPress} className="pressable-soft flex items-center gap-1.5">
          <span className="text-title-2 text-text">{displayedTitle}</span>
          <ChevronDown size={18} className="text-accent" />
        </button>
        <div className="flex items-center gap-4">
          <button type="button" onClick={handlePrev} className="pressable-soft p-1 text-accent" aria-label="Previous">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={handleNext} className="pressable-soft p-1 text-accent" aria-label="Next">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {pickerMode === "calendar" ? (
        <>
          <div className="mb-2 grid grid-cols-7 text-center">
            {DAYS_OF_WEEK.map((day) => (
              <span key={day} className="text-caption font-semibold text-text-3">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calendarGrid.map((item, index) => {
              const isSelected = selectedDate?.toDateString() === item.fullDate.toDateString();
              const isToday = item.fullDate.toDateString() === today;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!item.isCurrentMonth}
                  onClick={() => {
                    setSelectedDate(item.fullDate);
                    onSelectDate(item.fullDate);
                  }}
                  className={`pressable mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[16px] ${
                    isSelected
                      ? "bg-accent font-semibold text-white"
                      : item.isCurrentMonth
                        ? isToday
                          ? "font-semibold text-accent"
                          : "text-text"
                        : "text-text-4 opacity-40"
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {(pickerMode === "month" ? months : years).map((item, index) => {
            const isActive =
              pickerMode === "month" ? currentMonth.getMonth() === index : currentMonth.getFullYear() === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  if (pickerMode === "month") {
                    setCurrentMonth(new Date(currentMonth.getFullYear(), index, 1));
                    setPickerMode("calendar");
                  } else {
                    setCurrentMonth(new Date(Number(item), currentMonth.getMonth(), 1));
                    setPickerMode("month");
                  }
                }}
                className={`pressable h-12 rounded-xl text-[15px] font-semibold ${
                  isActive ? "bg-accent text-white" : "border border-border bg-surface text-text"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
};
