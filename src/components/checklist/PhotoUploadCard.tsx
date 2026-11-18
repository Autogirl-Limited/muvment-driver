"use client";

import type { ReactNode } from "react";
import { Camera, Check, RefreshCw, X } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";

interface PhotoUploadCardProps {
  title: string;
  subtitle?: string;
  imageUri?: string | null;
  uploading?: boolean;
  failed?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  /** Shown under a taken photo, e.g. the AI's verdict. */
  footer?: ReactNode;
}

const actionPill =
  "pressable-soft inline-flex h-9 items-center gap-1.5 rounded-full bg-[rgba(16,25,40,0.66)] px-3.5 text-[14px] font-semibold text-white backdrop-blur";

/**
 * One photo to take. Empty, it's a calm tap target. Taken, the photo shows
 * clean with its upload state on top: a dimmed spinner while uploading, a
 * "Saved" chip once it's in, a red bar if it failed, and Delete / Retake
 * below.
 */
export const PhotoUploadCard = ({
  title,
  subtitle,
  imageUri,
  uploading = false,
  failed = false,
  onClick,
  onRemove,
  footer,
}: PhotoUploadCardProps) => {
  if (!imageUri) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="card pressable mb-3 flex w-full items-center gap-3.5 p-4 text-left"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
          <Camera size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-body block font-semibold text-text">{title}</span>
          {subtitle && <span className="text-footnote mt-0.5 block text-text-3">{subtitle}</span>}
        </span>
        <span className="rounded-full bg-accent px-3.5 py-1.5 text-[14px] font-semibold text-white">Take</span>
      </button>
    );
  }

  return (
    <div className="card mb-3 overflow-hidden p-0">
      <div className="relative aspect-[4/3] bg-fill">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUri} alt={title} className="h-full w-full object-cover" />

        <span className="absolute left-3 top-3 rounded-full bg-[rgba(16,25,40,0.62)] px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur">
          {title}
        </span>

        {uploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(16,25,40,0.4)] text-white">
            <Spinner size={26} className="text-white" />
            <span className="mt-2.5 text-[15px] font-semibold">Uploading…</span>
          </span>
        )}

        {!uploading && !failed && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(16,25,40,0.62)] px-2.5 py-1 text-[12px] font-semibold text-white backdrop-blur">
            <Check size={11} strokeWidth={3.5} className="text-[#32D583]" />
            Saved
          </span>
        )}

        {failed && (
          <span role="alert" className="absolute inset-x-0 top-0 bg-[rgba(217,45,32,0.92)] px-3.5 py-2.5 pr-16 text-[14px] font-semibold text-white">
            {subtitle ?? "Upload failed. Retry or take a new photo."}
          </span>
        )}

        {!uploading && (
          <span className="absolute inset-x-3 bottom-3 flex justify-between">
            {onRemove ? (
              <button type="button" onClick={onRemove} aria-label={`Delete ${title} photo`} className={actionPill}>
                <X size={14} strokeWidth={2.5} />
                Delete
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClick} aria-label={`Retake ${title} photo`} className={actionPill}>
              <RefreshCw size={14} strokeWidth={2.5} />
              Retake
            </button>
          </span>
        )}
      </div>
      {footer && <div className="px-3 pb-3">{footer}</div>}
    </div>
  );
};
