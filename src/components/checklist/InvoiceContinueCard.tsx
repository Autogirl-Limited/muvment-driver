"use client";

import { ChevronRight, ReceiptText } from "lucide-react";

import type { ChecklistVehicleSelection } from "@/lib/utils/checklistVehicleSelection";

/** An invoice report begun but not sent: resume it, change the invoice or drop it. */
export const InvoiceContinueCard = ({
  selection,
  onContinue,
  onChange,
  onRemove,
}: {
  selection: ChecklistVehicleSelection;
  onContinue: () => void;
  onChange: () => void;
  onRemove: () => void;
}) => (
  <div className="card p-4">
    <div className="flex items-center">
      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-soft text-[#3538CD] dark:text-accent">
        <ReceiptText size={22} />
      </span>
      <div className="ml-3.5 min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-accent-text">INVOICE REPORT · NOT SENT YET</p>
        <p className="mt-0.5 truncate text-[17px] font-semibold text-text">{selection.invoiceNumber}</p>
        <p className="mt-0.5 truncate text-[13.5px] text-text-3">
          {selection.vehicle.name} · {selection.vehicle.identifier}
        </p>
      </div>
    </div>
    <button
      type="button"
      onClick={onContinue}
      className="pressable mt-3.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[16px] font-semibold text-white"
    >
      Continue invoice report
      <ChevronRight size={14} strokeWidth={3} />
    </button>
    <div className="mt-1 flex justify-between">
      <button type="button" onClick={onChange} className="pressable text-footnote h-11 px-1 font-semibold text-accent-text">
        Use a different invoice
      </button>
      <button type="button" onClick={onRemove} className="pressable text-footnote h-11 px-1 font-semibold text-danger-text">
        Remove
      </button>
    </div>
  </div>
);
