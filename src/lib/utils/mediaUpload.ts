import { ApiRequestError } from "../api/client";
import { createPresignedMediaUrl, deleteMedia, MEDIA_PRESIGNED_URL_PATH } from "../api/media";
import type { CreatePresignedMediaUrlPayload } from "../api/types";
import { isAppKnownOffline } from "./networkStatus";

export interface ChecklistPhotoUploadResult {
  fileUrl: string;
  publicCloudID: string;
}

/** Longest side kept before a checklist photo is downscaled. */
export const CHECKLIST_PHOTO_MAX_SIDE = 1600;

const CHECKLIST_MEDIA_CATEGORY = "RIDE_PHOTO";
const CHECKLIST_PHOTO_CONTENT_TYPE = "image/jpeg";
const CHECKLIST_PHOTO_QUALITY = 0.72;
const CHECKLIST_UPLOAD_RETRY_COUNT = 1;
const USE_PLACEHOLDER_UPLOAD = process.env.NEXT_PUBLIC_USE_PLACEHOLDER_UPLOAD === "true";
const DEFAULT_IMAGE_URL = process.env.NEXT_PUBLIC_DEFAULT_IMAGE_URL?.trim() ?? "";
const IS_DEV = process.env.NODE_ENV === "development";

export const CHECKLIST_UPLOAD_FAILED_MESSAGE =
  "We couldn't upload this photo. Check your internet connection and tap the photo to try again.";

class UploadRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "UploadRequestError";
    this.status = status;
  }
}

const runMediaStage = async <T>(
  stage: string,
  operation: () => Promise<T>,
  details: Record<string, unknown> = {},
) => {
  const startedAt = Date.now();

  try {
    const result = await operation();

    if (IS_DEV) {
      console.log(`[media:${stage}] completed`, { ...details, durationMs: Date.now() - startedAt });
    }

    return result;
  } catch (error) {
    if (IS_DEV) {
      console.warn(`[media:${stage}] failed`, { ...details, durationMs: Date.now() - startedAt, error });
    }

    throw error;
  }
};

/* ------------------------------------------------------------------ image prep */
const loadImage = (source: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === "function") {
    // imageOrientation: "from-image" honours EXIF rotation from phone cameras.
    return createImageBitmap(source, { imageOrientation: "from-image" }).catch(() =>
      createImageBitmap(source),
    );
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read the photo."));
    };
    image.src = url;
  });
};

/**
 * Downscales a captured photo so its longest side is at most
 * CHECKLIST_PHOTO_MAX_SIDE and re-encodes it as JPEG. Replaces
 * expo-image-manipulator from the native app.
 */
export const prepareChecklistPhoto = async (source: Blob): Promise<Blob> => {
  const image = await loadImage(source);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const longestSide = Math.max(width, height);
  const scale = longestSide > CHECKLIST_PHOTO_MAX_SIDE ? CHECKLIST_PHOTO_MAX_SIDE / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the photo for upload.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  if ("close" in image) {
    image.close();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Unable to encode the photo."))),
      CHECKLIST_PHOTO_CONTENT_TYPE,
      CHECKLIST_PHOTO_QUALITY,
    );
  });
};

/* ------------------------------------------------------------------ upload */
const buildFileName = () => {
  const timestampPart = Date.now().toString(36).slice(-5);
  const randomPart = Math.random().toString(36).slice(2, 7);

  return `${timestampPart}${randomPart}.jpg`;
};

const putBlobWithExactHeaders = ({
  blob,
  contentType,
  uploadUrl,
}: {
  blob: Blob;
  contentType: string;
  uploadUrl: string;
}) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new UploadRequestError(`Photo upload failed with status ${xhr.status}.`, xhr.status));
    };
    xhr.onerror = () => reject(new UploadRequestError(CHECKLIST_UPLOAD_FAILED_MESSAGE));
    xhr.ontimeout = () => reject(new UploadRequestError("Photo upload timed out.", 408));
    xhr.timeout = 60000;
    xhr.send(blob);
  });

const isTransientUploadError = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    return (
      error.code === "ERR_NETWORK" ||
      error.status === 408 ||
      error.status === 429 ||
      (typeof error.status === "number" && error.status >= 500)
    );
  }

  if (error instanceof UploadRequestError) {
    return (
      error.status === undefined || error.status === 408 || error.status === 429 || error.status >= 500
    );
  }

  return error instanceof TypeError;
};

const uploadPreparedChecklistPhotoOnce = async ({
  attempt,
  blob,
  label,
  tripId,
}: {
  attempt: number;
  blob: Blob;
  label: string;
  tripId: string;
}): Promise<ChecklistPhotoUploadResult> => {
  const presignRequestPayload: CreatePresignedMediaUrlPayload = {
    category: CHECKLIST_MEDIA_CATEGORY,
    contentType: CHECKLIST_PHOTO_CONTENT_TYPE,
    entityId: tripId,
    fileName: buildFileName(),
  };

  const presignedUrlData = await runMediaStage(
    "presign",
    async () => {
      try {
        const response = await createPresignedMediaUrl(presignRequestPayload);
        const data = response.data;

        if (!data?.uploadUrl || !data.fileUrl) {
          throw new UploadRequestError("Media upload response was missing upload details.");
        }

        if (!data.key?.trim()) {
          throw new UploadRequestError("Media upload response was missing storage key.");
        }

        return data;
      } catch (error) {
        if (error instanceof Error) {
          error.message = `${error.message} [POST ${MEDIA_PRESIGNED_URL_PATH}]`;
        }
        throw error;
      }
    },
    { attempt, label },
  );

  if (isAppKnownOffline()) {
    throw new UploadRequestError(CHECKLIST_UPLOAD_FAILED_MESSAGE);
  }

  await runMediaStage(
    "s3-put",
    () =>
      putBlobWithExactHeaders({
        blob,
        contentType: CHECKLIST_PHOTO_CONTENT_TYPE,
        uploadUrl: presignedUrlData.uploadUrl,
      }),
    { bytes: blob.size },
  );

  return {
    fileUrl: presignedUrlData.fileUrl,
    publicCloudID: presignedUrlData.key.trim(),
  };
};

export const uploadChecklistPhoto = async (
  file: Blob,
  label: string,
  tripId: string,
): Promise<ChecklistPhotoUploadResult> => {
  if (isAppKnownOffline()) {
    throw new Error(CHECKLIST_UPLOAD_FAILED_MESSAGE);
  }

  if (!tripId.trim()) {
    throw new Error("Missing trip ID for photo upload.");
  }

  if (USE_PLACEHOLDER_UPLOAD) {
    if (!DEFAULT_IMAGE_URL) {
      throw new Error("Placeholder upload is enabled, but NEXT_PUBLIC_DEFAULT_IMAGE_URL is missing.");
    }

    return { fileUrl: DEFAULT_IMAGE_URL, publicCloudID: DEFAULT_IMAGE_URL };
  }

  let preparedBlob: Blob;

  try {
    preparedBlob = await runMediaStage("prepare", () => prepareChecklistPhoto(file), {
      bytes: file.size,
    });
  } catch {
    throw new Error(CHECKLIST_UPLOAD_FAILED_MESSAGE);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= CHECKLIST_UPLOAD_RETRY_COUNT; attempt += 1) {
    try {
      return await uploadPreparedChecklistPhotoOnce({
        attempt: attempt + 1,
        blob: preparedBlob,
        label,
        tripId: tripId.trim(),
      });
    } catch (error) {
      lastError = error;
      const willRetry = attempt < CHECKLIST_UPLOAD_RETRY_COUNT && isTransientUploadError(error);

      if (!willRetry) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(CHECKLIST_UPLOAD_FAILED_MESSAGE);
};

export const deleteChecklistPhoto = async (fileUrl: string) => {
  if (!fileUrl.trim() || USE_PLACEHOLDER_UPLOAD) {
    return;
  }

  await deleteMedia({ fileUrl });
};

export const deleteChecklistPhotoBestEffort = async (fileUrl?: string) => {
  if (!fileUrl) {
    return;
  }

  try {
    await deleteChecklistPhoto(fileUrl);
  } catch (error) {
    if (IS_DEV) {
      console.warn("[media:delete] checklist cleanup failed", error);
    }
  }
};
