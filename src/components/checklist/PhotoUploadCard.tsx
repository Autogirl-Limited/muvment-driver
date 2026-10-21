"use client";

import { Camera, XCircle } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";

interface PhotoUploadCardProps {
  title: string;
  subtitle?: string;
  imageUri?: string | null;
  uploading?: boolean;
  failed?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

export const PhotoUploadCard = ({
  title,
  subtitle,
  imageUri,
  uploading = false,
  failed = false,
  onClick,
  onRemove,
}: PhotoUploadCardProps) => {
  const isFilled = Boolean(imageUri);

  return (
    <div
      className={`relative mb-3 h-40 overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
        failed ? "border-danger" : isFilled ? "border-accent" : "border-border-strong bg-surface"
      }`}
    >
      <button type="button" onClick={onClick} className="pressable-soft block h-full w-full text-left">
        {isFilled ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUri!} alt={title} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex flex-col items-center justify-center bg-bg/60 p-4 backdrop-blur-[2px]">
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-2 shadow-float">
                {uploading ? <Spinner size={18} className="text-accent" /> : <Camera size={18} />}
              </span>
              <span className="text-headline text-[15px] text-text">{title}</span>
              {subtitle && (
                <span className={`text-caption mt-1 text-center ${failed ? "text-danger" : "text-text-2"}`}>
                  {subtitle}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="flex h-full flex-col items-center justify-center p-4">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-alt text-text-2">
              <Camera size={18} />
            </span>
            <span className="text-body font-medium text-text">{title}</span>
            {subtitle && <span className="text-caption mt-1 text-center text-text-3">{subtitle}</span>}
          </span>
        )}
      </button>

      {isFilled && onRemove && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title} photo`}
          className="pressable-soft absolute top-2 right-2 rounded-full bg-bg/70 p-1 text-danger backdrop-blur"
        >
          <XCircle size={24} />
        </button>
      )}
    </div>
  );
};
