/**
 * An invoice report the driver has begun (invoice entered, vehicle confirmed)
 * but not sent anything for yet. The server has no report until the exterior
 * photos are sent, so the phone's saved pick is what "Continue" resumes from.
 */
import { clearPhotoDraft } from "@/hooks/usePhotoSlot";

import { getPreRideStarterStepRoute } from "./checklistNavigation";
import {
  clearChecklistVehicleSelection,
  readChecklistVehicleSelection,
  writeChecklistVehicleSelection,
  type ChecklistVehicleSelection,
} from "./checklistVehicleSelection";
import { toLagosDate } from "./lagosTime";

/** Straight to the exterior photos: the invoice and vehicle are already chosen. */
export const PENDING_INVOICE_RESUME_ROUTE = getPreRideStarterStepRoute(2);

/**
 * What a report that isn't on the server yet saves its photos under. An invoice
 * report adds the vehicle, so one car's photos never show up for another. The
 * daily report keeps the driver-and-day scope.
 */
export const getNewPreRideScope = (userId: string, selection?: ChecklistVehicleSelection | null) => {
  const dailyScope = `${userId}-${toLagosDate(new Date())}`;

  return selection ? `${dailyScope}-invoice-${selection.vehicle.id}` : dailyScope;
};

const clearInvoicePhotoDrafts = (userId: string, selection: ChecklistVehicleSelection) => {
  const scope = getNewPreRideScope(userId, selection);

  clearPhotoDraft(`exterior:${scope}`);
  clearPhotoDraft(`exterior-damage:${scope}`);
};

/** Saves the confirmed pick. Changing vehicle drops the previous vehicle's photos. */
export const saveInvoiceSelection = (userId: string, selection: ChecklistVehicleSelection) => {
  const previous = readChecklistVehicleSelection(userId);

  if (previous && previous.vehicle.id !== selection.vehicle.id) {
    clearInvoicePhotoDrafts(userId, previous);
  }

  writeChecklistVehicleSelection(userId, selection);
};

/** The driver gave up on this invoice: forget the pick and its unsent photos. */
export const discardInvoiceSelection = (userId: string) => {
  const selection = readChecklistVehicleSelection(userId);

  if (selection) clearInvoicePhotoDrafts(userId, selection);
  clearChecklistVehicleSelection(userId);
};
