/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

import { getApiBaseUrl } from "@/lib/api/client";
import { bankLogoPath } from "@/lib/payments/bankLogos";

/** Apple system colours, picked by a hash of the name so a bank always gets the same one. */
const TILE_COLOURS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF2D55", "#5856D6", "#30B0C7", "#A2845E", "#FF3B30", "#00C7BE"];

/** Logos this session has already failed to load: not asked for again. */
const failedLogos = new Set<string>();

const colourFor = (name: string) => {
  let hash = 0;
  for (const character of name.toLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return TILE_COLOURS[hash % TILE_COLOURS.length];
};

const initialFor = (name: string) => name.replace(/^the\s+/i, "").match(/[a-z0-9]/i)?.[0]?.toUpperCase() ?? "?";

/** The backend serves and caches each bank's logo: `GET /banks/{code}/logo`. */
export const bankLogoUrl = (bankCode?: string | null) => {
  const code = bankCode?.trim();
  if (!code) return undefined;

  try {
    return `${getApiBaseUrl()}/banks/${encodeURIComponent(code)}/logo`;
  } catch {
    return undefined; // no API URL configured
  }
};

/**
 * A bank's logo on a small tile. The logo bundled with the app shows at once;
 * for a bank without one, the backend's logo loads over a coloured square with
 * the bank's first letter, which stays if it can't. Logos sit on white
 * (they're drawn for white), in dark mode too.
 */
export const BankLogo = ({
  bankName,
  bankCode,
  size = 40,
  className = "",
}: {
  bankName?: string | null;
  bankCode?: string | null;
  size?: number;
  className?: string;
}) => {
  // The bundled logo needs no network; the backend is asked only when there is none.
  const url = bankLogoPath(bankName, bankCode) ?? bankLogoUrl(bankCode);
  const [failedUrl, setFailedUrl] = useState<string>();
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const name = bankName?.trim() || "Bank";
  const showImage = Boolean(url) && url !== failedUrl && !failedLogos.has(url ?? "");
  const isLoaded = Boolean(url) && url === loadedUrl;

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        backgroundColor: showImage && isLoaded ? "#FFFFFF" : colourFor(name),
      }}
    >
      {!(showImage && isLoaded) && (
        <span className="font-bold text-white" style={{ fontSize: size * 0.42 }}>
          {initialFor(name)}
        </span>
      )}
      {showImage && (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          onLoad={() => setLoadedUrl(url)}
          onError={() => {
            failedLogos.add(url ?? "");
            setFailedUrl(url);
          }}
          className={`absolute inset-0 h-full w-full bg-white object-contain p-[12%] transition-opacity duration-200 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
};
