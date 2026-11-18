import { storage } from "@/lib/utils/storage";

/**
 * The incident report being written, kept on the phone as the driver goes, so
 * they can stop at any point and pick it up later. One draft at a time; it's
 * cleared once the report is sent or the driver discards it. Only the photo's
 * uploaded address is kept (a camera preview can't outlive the page).
 */

export type IncidentCategory = "ACCIDENT" | "DAMAGE" | "BREAKDOWN" | "CUSTOMER" | "POLICE" | "OTHER";

export const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string; prompt: string }[] = [
  { label: "Accident", prompt: "What happened, where, and was anyone hurt?", value: "ACCIDENT" },
  { label: "Damage", prompt: "Which part of the car is damaged, and how did it happen?", value: "DAMAGE" },
  { label: "Breakdown", prompt: "What stopped working, and where are you now?", value: "BREAKDOWN" },
  { label: "Customer Issue", prompt: "What happened with the customer?", value: "CUSTOMER" },
  { label: "Police or Traffic Stop", prompt: "Why were you stopped, and what were you told?", value: "POLICE" },
  { label: "Something Else", prompt: "Describe what happened.", value: "OTHER" },
];

export const MIN_INCIDENT_DESCRIPTION = 10;

export const categoryInfo = (value?: IncidentCategory | null) =>
  INCIDENT_CATEGORIES.find((category) => category.value === value);

export interface IncidentDraft {
  tripId?: string;
  /** How the trip reads in the draft card (client · time), saved with it. */
  tripLabel?: string;
  category?: IncidentCategory;
  description: string;
  /** The photo's address once uploaded. */
  photoUrl?: string;
  updatedAt: number;
}

const KEY = "incident-draft";

export const readIncidentDraft = (): IncidentDraft | undefined => {
  const draft = storage.getJSON<IncidentDraft>(KEY);

  return draft && (draft.tripId || draft.description || draft.photoUrl || draft.category) ? draft : undefined;
};

/** Merges changes into the draft and saves it. */
export const saveIncidentDraft = (changes: Partial<IncidentDraft>) => {
  const next: IncidentDraft = { description: "", ...readIncidentDraft(), ...changes, updatedAt: Date.now() };

  storage.setJSON(KEY, next);

  return next;
};

export const clearIncidentDraft = () => storage.remove(KEY);

/** What's sent: the type first ("Accident: …"), so the list can show it without a server change. */
export const composeDescription = (category: IncidentCategory | undefined, text: string) => {
  const info = categoryInfo(category);
  const body = text.trim();

  return info ? `${info.label}: ${body}` : body;
};

/** Splits a sent description back into its type and text. */
export const parseDescription = (description: string): { category?: (typeof INCIDENT_CATEGORIES)[number]; text: string } => {
  const match = INCIDENT_CATEGORIES.find((category) => description.startsWith(`${category.label}:`));

  return match ? { category: match, text: description.slice(match.label.length + 1).trim() } : { text: description };
};
