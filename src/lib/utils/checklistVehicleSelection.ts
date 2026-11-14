import type { ChecklistInvoiceVehicle } from "../api/types";
import { toLagosDate } from "./lagosTime";

const STORAGE_KEY_PREFIX = "pre-ride-invoice-vehicle";

export interface ChecklistVehicleSelection {
  invoiceNumber: string;
  vehicle: ChecklistInvoiceVehicle;
}

const getStorageKey = (userId: string) =>
  `${STORAGE_KEY_PREFIX}:${userId.trim()}:${toLagosDate(new Date())}`;

const getSessionStorage = () =>
  typeof window === "undefined" ? undefined : window.sessionStorage;

export const readChecklistVehicleSelection = (
  userId?: string | null,
): ChecklistVehicleSelection | undefined => {
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) return undefined;

  const rawValue = getSessionStorage()?.getItem(getStorageKey(normalizedUserId));
  if (!rawValue) return undefined;

  try {
    const parsed = JSON.parse(rawValue) as Partial<ChecklistVehicleSelection>;
    const vehicle = parsed.vehicle;

    if (
      !parsed.invoiceNumber?.trim() ||
      !vehicle?.id?.trim() ||
      !vehicle.name?.trim() ||
      !vehicle.identifier?.trim() ||
      (vehicle.source !== "ASSIGNED" && vehicle.source !== "INVOICE")
    ) {
      return undefined;
    }

    return {
      invoiceNumber: parsed.invoiceNumber.trim(),
      vehicle: {
        ...vehicle,
        id: vehicle.id.trim(),
        identifier: vehicle.identifier.trim(),
        name: vehicle.name.trim(),
      },
    };
  } catch {
    return undefined;
  }
};

export const writeChecklistVehicleSelection = (
  userId: string,
  selection: ChecklistVehicleSelection,
) => {
  getSessionStorage()?.setItem(getStorageKey(userId), JSON.stringify(selection));
};

export const clearChecklistVehicleSelection = (userId?: string | null) => {
  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) return;
  getSessionStorage()?.removeItem(getStorageKey(normalizedUserId));
};
