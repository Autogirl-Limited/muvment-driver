"use client";

import type { ReactNode } from "react";

import { BackButton } from "@/components/ui/BackButton";
import { NavBar, Screen } from "@/components/ui/Screen";
import { Banner, ChecklistFooter } from "./ChecklistFooter";
import { StepIndicator } from "./StepIndicator";
import type { ButtonProps } from "@/components/ui/Button";

interface ChecklistShellProps {
  currentStep: number;
  totalSteps?: number;
  onStepPress?: (step: number) => void;
  title: string;
  banner?: string;
  children: ReactNode;
  footer: ButtonProps;
  backHref?: string;
}

/** Common frame for every checklist step: back, step dots, title, warning banner, sticky footer. */
export const ChecklistShell = ({
  currentStep,
  totalSteps = 4,
  onStepPress,
  title,
  banner,
  children,
  footer,
  backHref = "/home",
}: ChecklistShellProps) => (
  <Screen>
    <NavBar left={<BackButton href={backHref} />} />
    <div className="px-5">
      <StepIndicator currentStep={currentStep} totalSteps={totalSteps} onStepPress={onStepPress} />
      <h1 className="text-title-2 mb-4 text-text">{title}</h1>
    </div>
    {banner && <Banner>{banner}</Banner>}
    <div className="anim-fade-in flex-1 px-5 pb-6">{children}</div>
    <ChecklistFooter {...footer} />
  </Screen>
);

export const ChecklistSectionTitle = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`text-eyebrow mb-3 text-text ${className}`}>{children}</p>
);
