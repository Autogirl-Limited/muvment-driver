import type {
  ChecklistRideImage,
  ChecklistUploadedPhoto,
} from "../api/types";

export type ChecklistPhotoUploadStatus =
  | "empty"
  | "failed"
  | "uploaded"
  | "uploading";

export interface ChecklistPhotoState {
  errorMessage?: string;
  fileUrl?: string;
  localUri: string | null;
  publicCloudID?: string;
  status: ChecklistPhotoUploadStatus;
}

export const createEmptyChecklistPhoto = (): ChecklistPhotoState => ({
  localUri: null,
  status: "empty",
});

export const createUploadedChecklistPhoto = (
  fileUrl: string,
  publicCloudID = fileUrl,
): ChecklistPhotoState => ({
  fileUrl,
  localUri: fileUrl,
  publicCloudID,
  status: "uploaded",
});

export const isChecklistPhotoUploaded = (
  photo: ChecklistPhotoState,
): photo is ChecklistPhotoState & Required<
  Pick<ChecklistPhotoState, "fileUrl">
> =>
  photo.status === "uploaded" &&
  Boolean(photo.fileUrl);

const UUID_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/**
 * The backend's ride_image.public_id column is sized for a bare UUID
 * (character(36)), but our storage key looks like
 * "staging/rides/<ride-uuid>/photos/<file-uuid>-<random>.jpg" - sending the
 * full key overflows that column on every insert. The file's own UUID (the
 * last path segment, before its "-<random>.<ext>" suffix) is what the
 * backend actually wants there.
 */
const extractStorageKeyUuid = (value: string) => {
  const lastSegment = value.split("/").pop() ?? value;
  const match = UUID_PATTERN.exec(lastSegment);

  return match ? match[1] : value;
};

export const toChecklistUploadedPhoto = (
  photo: ChecklistPhotoState,
): ChecklistUploadedPhoto => {
  if (!isChecklistPhotoUploaded(photo)) {
    throw new Error("Photo has not finished uploading.");
  }

  const rawPublicCloudID = photo.publicCloudID?.trim();

  if (!rawPublicCloudID) {
    throw new Error(
      "Photo is missing storage metadata. Please retake the photo.",
    );
  }

  return {
    imageURL: photo.fileUrl,
    publicCloudID: extractStorageKeyUuid(rawPublicCloudID),
  };
};

const normalizeChecklistImageType = (value?: string | null) =>
  value?.trim().toUpperCase().replace(/[\s-]+/g, "_");

const getChecklistRideImageUrl = (image: ChecklistRideImage) =>
  image.fileUrl?.trim() || image.url?.trim() || undefined;

export const getChecklistPhotoUrlsByType = (
  rideImages: ChecklistRideImage[] | undefined,
  type: string,
) => {
  const normalizedType = normalizeChecklistImageType(type);

  return (rideImages ?? [])
    .filter(
      (image) => normalizeChecklistImageType(image.type) === normalizedType,
    )
    .map(getChecklistRideImageUrl)
    .filter((url): url is string => Boolean(url));
};

export const getChecklistPhotoUrls = (
  rideImages: ChecklistRideImage[] | undefined,
) => (rideImages ?? [])
  .map(getChecklistRideImageUrl)
  .filter((url): url is string => Boolean(url));

export const getChecklistPhotoUrlByType = (
  rideImages: ChecklistRideImage[] | undefined,
  type: string,
) => getChecklistPhotoUrlsByType(rideImages, type)[0];

export const hydrateChecklistPhoto = (
  currentPhoto: ChecklistPhotoState,
  fileUrl: string | undefined,
  publicCloudID?: string,
) => {
  if (!fileUrl || currentPhoto.status !== "empty") {
    return currentPhoto;
  }

  return createUploadedChecklistPhoto(fileUrl, publicCloudID);
};
