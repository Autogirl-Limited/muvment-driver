"use client";

import { useCallback, useRef, useState } from "react";

import { getApiErrorMessage } from "@/lib/api/errors";
import {
  createEmptyChecklistPhoto,
  isChecklistPhotoUploaded,
  type ChecklistPhotoState,
} from "@/lib/utils/checklistPhotos";
import { capturePhoto, type CameraFacing } from "@/lib/utils/deviceActions";
import {
  CHECKLIST_UPLOAD_FAILED_MESSAGE,
  deleteChecklistPhoto,
  deleteChecklistPhotoBestEffort,
  uploadChecklistPhoto,
} from "@/lib/utils/mediaUpload";
import { useToast } from "@/providers/ToastProvider";

/**
 * Shared capture → upload → retry/remove state machine for every checklist
 * photo. Each slot keeps the captured File so a failed upload can be retried
 * without re-opening the camera (same behaviour as the native app).
 */
export const usePhotoSlots = <TKey extends string>(keys: readonly TKey[]) => {
  const toast = useToast();
  const [photos, setPhotos] = useState<Record<TKey, ChecklistPhotoState>>(
    () => Object.fromEntries(keys.map((key) => [key, createEmptyChecklistPhoto()])) as Record<TKey, ChecklistPhotoState>,
  );
  const files = useRef(new Map<TKey, File>());

  const update = useCallback((key: TKey, next: ChecklistPhotoState) => {
    setPhotos((current) => ({ ...current, [key]: next }));
  }, []);

  const capture = useCallback(
    async ({
      key,
      label,
      entityId,
      facing = "environment",
      beforeCapture,
    }: {
      key: TKey;
      label: string;
      entityId?: string;
      facing?: CameraFacing;
      beforeCapture?: () => boolean;
    }) => {
      const current = photos[key];

      if (current.status === "uploading") {
        return;
      }

      if (!entityId) {
        toast.error("Report unavailable", "Please go back and open the report again.");
        return;
      }

      if (beforeCapture && !beforeCapture()) {
        return;
      }

      let file = current.status === "failed" ? files.current.get(key) : undefined;
      let previewUrl = current.status === "failed" ? current.localUri : null;

      if (!file) {
        const captured = await capturePhoto(facing);

        if (!captured) {
          return;
        }

        file = captured.file;
        previewUrl = captured.previewUrl;
        files.current.set(key, file);
      }

      const previousFileUrl = isChecklistPhotoUploaded(current) ? current.fileUrl : undefined;

      update(key, { localUri: previewUrl, status: "uploading" });

      try {
        const result = await uploadChecklistPhoto(file, label, entityId);

        update(key, { ...result, localUri: previewUrl, status: "uploaded" });
        void deleteChecklistPhotoBestEffort(previousFileUrl);
      } catch (error) {
        const message = getApiErrorMessage(error) ?? CHECKLIST_UPLOAD_FAILED_MESSAGE;

        update(key, { errorMessage: message, localUri: previewUrl, status: "failed" });
        toast.error("Upload failed", message);
      }
    },
    [photos, toast, update],
  );

  const remove = useCallback(
    async (key: TKey) => {
      const current = photos[key];

      if (isChecklistPhotoUploaded(current)) {
        try {
          await deleteChecklistPhoto(current.fileUrl);
        } catch {
          toast.error("Remove failed", "Please try removing the photo again.");
          return;
        }
      }

      files.current.delete(key);
      update(key, createEmptyChecklistPhoto());
    },
    [photos, toast, update],
  );

  const list = Object.values(photos) as ChecklistPhotoState[];

  return {
    photos,
    list,
    capture,
    remove,
    hasPendingUpload: list.some((photo) => photo.status === "uploading"),
    hasFailedUpload: list.some((photo) => photo.status === "failed"),
    subtitleFor: (key: TKey, fallback: string) => {
      const photo = photos[key];

      if (photo.status === "uploading") return "Uploading...";
      if (photo.status === "failed") return photo.errorMessage ?? CHECKLIST_UPLOAD_FAILED_MESSAGE;

      return fallback;
    },
  };
};

/** Variable-length list of optional photos (damage close-ups). */
export const usePhotoList = (max: number) => {
  const toast = useToast();
  const [photos, setPhotos] = useState<ChecklistPhotoState[]>([]);
  const files = useRef<(File | undefined)[]>([]);

  const setAt = (index: number, next: ChecklistPhotoState) => {
    setPhotos((current) => current.map((photo, i) => (i === index ? next : photo)));
  };

  const uploadAt = async (index: number, file: File, previewUrl: string | null, label: string, entityId: string) => {
    const previous = photos[index];
    const previousFileUrl = previous && isChecklistPhotoUploaded(previous) ? previous.fileUrl : undefined;

    try {
      const result = await uploadChecklistPhoto(file, label, entityId);

      setAt(index, { ...result, localUri: previewUrl, status: "uploaded" });
      void deleteChecklistPhotoBestEffort(previousFileUrl);
    } catch (error) {
      const message = getApiErrorMessage(error) ?? CHECKLIST_UPLOAD_FAILED_MESSAGE;

      setAt(index, { errorMessage: message, localUri: previewUrl, status: "failed" });
      toast.error("Upload failed", message);
    }
  };

  const add = async (labelPrefix: string, entityId?: string) => {
    if (photos.length >= max) {
      return;
    }

    if (!entityId) {
      toast.error("Report unavailable", "Please go back and open the report again.");
      return;
    }

    const captured = await capturePhoto();

    if (!captured) {
      return;
    }

    const index = photos.length;
    files.current[index] = captured.file;
    setPhotos((current) => [...current, { localUri: captured.previewUrl, status: "uploading" }]);
    await uploadAt(index, captured.file, captured.previewUrl, `${labelPrefix}-${index + 1}`, entityId);
  };

  const retake = async (index: number, labelPrefix: string, entityId?: string) => {
    const current = photos[index];

    if (!current || current.status === "uploading") {
      return;
    }

    if (!entityId) {
      toast.error("Report unavailable", "Please go back and open the report again.");
      return;
    }

    let file = current.status === "failed" ? files.current[index] : undefined;
    let previewUrl = current.status === "failed" ? current.localUri : null;

    if (!file) {
      const captured = await capturePhoto();

      if (!captured) {
        return;
      }

      file = captured.file;
      previewUrl = captured.previewUrl;
      files.current[index] = file;
    }

    setAt(index, { localUri: previewUrl, status: "uploading" });
    await uploadAt(index, file, previewUrl, `${labelPrefix}-${index + 1}`, entityId);
  };

  const remove = async (index: number) => {
    const current = photos[index];

    if (current && isChecklistPhotoUploaded(current)) {
      try {
        await deleteChecklistPhoto(current.fileUrl);
      } catch {
        toast.error("Remove failed", "Please try removing the photo again.");
        return;
      }
    }

    files.current.splice(index, 1);
    setPhotos((current) => current.filter((_, i) => i !== index));
  };

  return {
    photos,
    add,
    retake,
    remove,
    hasPendingUpload: photos.some((photo) => photo.status === "uploading"),
    hasFailedUpload: photos.some((photo) => photo.status === "failed"),
    subtitleFor: (photo: ChecklistPhotoState, fallback: string) => {
      if (photo.status === "uploading") return "Uploading...";
      if (photo.status === "failed") return photo.errorMessage ?? CHECKLIST_UPLOAD_FAILED_MESSAGE;

      return fallback;
    },
  };
};
