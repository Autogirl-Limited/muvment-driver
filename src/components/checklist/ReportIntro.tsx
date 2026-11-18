"use client";

import type { ComponentType, ReactNode } from "react";
import { Check, ChevronRight, Clock, Sparkles } from "lucide-react";

export interface ReportIntroPart {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Hex colour for the icon and its soft background. */
  tint: string;
  title: string;
  detail: string;
  /** Rough time for this part, e.g. "1 min". */
  time: string;
}

const BADGE_POSITIONS = [
  { top: 14, left: 14 },
  { top: 14, right: 14 },
  { bottom: 16, left: 22 },
  { bottom: 16, right: 22 },
] as const;

/** A simple side-on car, drawn with the app's own colours so it works in light and dark. */
const CarSketch = () => (
  <svg viewBox="0 0 320 130" width="300" height="122" aria-hidden="true">
    <path
      d="M24 92c0-10 6-17 15-19l30-8 28-28c5-5 11-7 18-7h86c9 0 17 4 23 10l26 25 32 6c10 2 17 10 17 20v6c0 5-4 9-9 9h-14a30 30 0 0 0-59 0H123a30 30 0 0 0-59 0H33c-5 0-9-4-9-9z"
      fill="var(--surface)"
      stroke="var(--text-3)"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M100 66l20-20h56v20zM186 46h12c5 0 9 2 12 5l14 15h-38z" fill="var(--accent-soft)" stroke="var(--text-3)" strokeWidth="2.5" strokeLinejoin="round" />
    {[93, 227].map((x) => (
      <g key={x}>
        <circle cx={x} cy="102" r="22" fill="var(--text)" />
        <circle cx={x} cy="102" r="10" fill="var(--surface-alt)" stroke="var(--text-3)" strokeWidth="2" />
      </g>
    ))}
  </svg>
);

const IntroHero = ({ parts }: { parts: ReportIntroPart[] }) => (
  <div
    aria-hidden="true"
    className="relative flex h-[230px] items-center justify-center overflow-hidden rounded-[28px] bg-fill"
  >
    <span className="anim-glow-breathe absolute h-[260px] w-[260px] rounded-full bg-accent-soft" />
    <div className="relative mt-1.5">
      <CarSketch />
    </div>
    <span className="anim-scan-sweep pointer-events-none absolute bottom-0 left-0 top-0 w-[70px] bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    {parts.slice(0, BADGE_POSITIONS.length).map((part, index) => {
      const Icon = part.icon;

      return (
        <span
          key={part.title}
          className="absolute"
          style={{
            ...BADGE_POSITIONS[index],
            animation: `badge-pop 0.5s var(--ease-spring) ${0.9 + index * 0.26}s both`,
          }}
        >
          <span
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-2.5 shadow-md"
            style={{ animation: `badge-bob ${1.8 + index * 0.2}s ease-in-out ${1.4 + index * 0.18}s infinite` }}
          >
            <span
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
              style={{ backgroundColor: `${part.tint}22`, color: part.tint }}
            >
              <Icon size={12} strokeWidth={2.5} />
            </span>
            <span className="text-[12px] font-semibold text-text">{part.title.split(" ")[0]}</span>
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-white">
              <Check size={8} strokeWidth={4} />
            </span>
          </span>
        </span>
      );
    })}
  </div>
);

/** The big call to action: a gradient pill with a light that glides across it. */
export const BeginButton = ({ title, onClick }: { title: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={title}
    className="pressable relative flex h-[62px] w-full items-center justify-center gap-3 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] px-5 text-[18px] font-bold tracking-tight text-white shadow-[0_8px_18px_rgba(10,132,255,0.35)]"
  >
    <span className="anim-button-shine pointer-events-none absolute bottom-0 left-0 top-0 w-[60px] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
    {title}
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20">
      <ChevronRight size={15} strokeWidth={3} />
    </span>
  </button>
);

interface ReportIntroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  totalTime: string;
  parts: ReportIntroPart[];
  beginTitle: string;
  onBegin: () => void;
  header?: ReactNode;
  /** The line under the list. Pass null for none. */
  note?: string | null;
}

/**
 * The page before a pilot report's first step: what the driver is about to
 * do, how long it takes, and one inviting button to begin.
 */
export const ReportIntro = ({ eyebrow, title, subtitle, totalTime, parts, beginTitle, onBegin, header, note }: ReportIntroProps) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex h-[52px] items-center px-2">{header}</div>
    <div className="scroll-y min-h-0 flex-1 px-5 pb-6">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="anim-fade-in">
          <IntroHero parts={parts} />
        </div>

        <div className="anim-rise-in mt-6 px-1" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-accent-text">{eyebrow}</span>
            <span className="ml-2.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-[3px] text-[12px] font-semibold text-accent-text">
              <Clock size={11} strokeWidth={2.5} />
              {totalTime}
            </span>
          </div>
          <h1 className="mt-1.5 text-[32px] font-bold leading-[38px] tracking-[-0.8px] text-text">{title}</h1>
          <p className="mt-2 text-[16px] leading-[23px] text-text-3">{subtitle}</p>
        </div>

        <ol className="card mt-[22px] overflow-hidden rounded-[22px] p-0">
          {parts.map((part, index) => {
            const Icon = part.icon;

            return (
              <li
                key={part.title}
                className="anim-rise-in flex items-center pl-3.5"
                style={{ animationDelay: `${220 + index * 90}ms` }}
              >
                <span
                  className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                  style={{ backgroundColor: `${part.tint}1F`, color: part.tint }}
                >
                  <Icon size={17} strokeWidth={2.25} />
                </span>
                <div
                  className={`flex min-h-16 flex-1 items-center py-2.5 pr-4 ${
                    index < parts.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <div className="mr-2.5 min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-text">
                      {index + 1}. {part.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-[18px] text-text-3">{part.detail}</p>
                  </div>
                  <span className="text-[13px] font-medium tabular-nums text-text-4">{part.time}</span>
                </div>
              </li>
            );
          })}
        </ol>

        {note !== null && (
          <p className="mt-4 flex items-start gap-2 px-1.5 text-[13px] leading-[18px] text-text-3">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-accent-text" />
            {note ?? "Each photo is checked by AI as you go, so you'll know straight away if one needs retaking."}
          </p>
        )}
      </div>
    </div>
    <div className="px-5 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
      <div className="mx-auto w-full max-w-[560px]">
        <BeginButton title={beginTitle} onClick={onBegin} />
      </div>
    </div>
  </div>
);
