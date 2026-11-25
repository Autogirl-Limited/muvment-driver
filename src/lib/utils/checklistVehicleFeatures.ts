import type { VehicleFeature } from "@/lib/api/types";
import { storage } from "@/lib/utils/storage";

const FEATURE_SELECTION_PREFIX = "checklist-feature-selection:";

export type SelectedVehicleFeature = Pick<VehicleFeature, "id" | "name">;

const selectionKey = (trackerId: string) => `${FEATURE_SELECTION_PREFIX}${trackerId}`;

export const isChargerFeature = (feature: Pick<VehicleFeature, "name">) =>
  feature.name.toLowerCase().includes("charger");

export const readChecklistFeatureSelection = (trackerId: string): SelectedVehicleFeature[] => {
  if (!trackerId) return [];
  const stored = storage.getJSON<unknown>(selectionKey(trackerId));

  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (feature): feature is SelectedVehicleFeature =>
      typeof feature === "object" &&
      feature !== null &&
      typeof (feature as Record<string, unknown>).id === "string" &&
      typeof (feature as Record<string, unknown>).name === "string",
  );
};

export const saveChecklistFeatureSelection = (trackerId: string, features: SelectedVehicleFeature[]) => {
  if (trackerId) storage.setJSON(selectionKey(trackerId), features);
};

export const clearChecklistFeatureSelection = (trackerId: string) => {
  if (trackerId) storage.remove(selectionKey(trackerId));
};

export const joinFeatureNames = (names: string[]) => {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};
