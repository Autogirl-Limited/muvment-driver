/**
 * Browser equivalents of the native "open maps / open camera / call" actions.
 * Photos come from a hidden <input type="file" capture> so iOS Safari and
 * Android Chrome open the camera directly; the chosen file is returned
 * together with an object URL used for the on-screen preview.
 */
export type CapturedPhoto = {
  file: File;
  previewUrl: string;
};

export type CameraFacing = "environment" | "user";

export const capturePhoto = (facing: CameraFacing = "environment"): Promise<CapturedPhoto | null> =>
  new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", facing);
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.style.width = "1px";
    input.style.height = "1px";

    let settled = false;
    const finish = (value: CapturedPhoto | null) => {
      if (settled) {
        return;
      }
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];

      if (!file) {
        finish(null);
        return;
      }

      finish({ file, previewUrl: URL.createObjectURL(file) });
    });

    // The "cancel" event is supported by modern browsers; fall back to a focus check for others.
    input.addEventListener("cancel", () => finish(null));
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!input.files?.length) {
            finish(null);
          }
        }, 1200);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });

const buildMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const getMapsSearchUrl = ({
  address,
  lat,
  lng,
}: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) => {
  const hasCoordinates =
    typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
  const addressQuery = address?.trim();
  const query = addressQuery || (hasCoordinates ? `${lat},${lng}` : "");

  return query ? buildMapsSearchUrl(query) : null;
};

export const getMapsDirectionsUrl = ({
  destinationAddress,
  destinationLat,
  destinationLng,
  originLat,
  originLng,
}: {
  destinationAddress?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  originLat?: number | null;
  originLng?: number | null;
}) => {
  const hasDestinationCoordinates =
    typeof destinationLat === "number" &&
    Number.isFinite(destinationLat) &&
    typeof destinationLng === "number" &&
    Number.isFinite(destinationLng);
  const hasOriginCoordinates =
    typeof originLat === "number" &&
    Number.isFinite(originLat) &&
    typeof originLng === "number" &&
    Number.isFinite(originLng);
  const destinationQuery =
    destinationAddress?.trim() ||
    (hasDestinationCoordinates ? `${destinationLat},${destinationLng}` : "");

  if (!destinationQuery) {
    return null;
  }

  const params = new URLSearchParams({ api: "1", destination: destinationQuery, travelmode: "driving" });

  if (hasOriginCoordinates) {
    params.set("origin", `${originLat},${originLng}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const openExternalUrl = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

export const getPhoneUrl = (phoneNumber?: string | null) => {
  const formattedNumber = phoneNumber?.replace(/[^0-9+]/g, "");

  return formattedNumber ? `tel:${formattedNumber}` : null;
};

export const getWhatsAppUrl = (phoneNumber?: string | null) => {
  const formattedNumber = phoneNumber?.replace(/[^0-9+]/g, "").replace(/^\+/, "");

  return formattedNumber ? `https://wa.me/${formattedNumber}` : null;
};
