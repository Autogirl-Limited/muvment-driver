"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, WifiOff } from "lucide-react";

import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { AlertDialog } from "@/components/ui/Dialog";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCreateIncidentReport, useDriverTrips } from "@/lib/api/hooks/useTrips";
import type { DriverTrip } from "@/lib/api/types";
import {
  categoryInfo,
  clearIncidentDraft,
  composeDescription,
  INCIDENT_CATEGORIES,
  MIN_INCIDENT_DESCRIPTION,
  readIncidentDraft,
  saveIncidentDraft,
  type IncidentCategory,
} from "@/lib/incident/incidentDraft";
import { capturePhoto } from "@/lib/utils/deviceActions";
import { formatLagosTime, toLagosDate } from "@/lib/utils/lagosTime";
import { CHECKLIST_UPLOAD_FAILED_MESSAGE, uploadChecklistPhoto } from "@/lib/utils/mediaUpload";
import { useNetworkStatus } from "@/providers/NetworkStatusProvider";
import { useToast } from "@/providers/ToastProvider";

type Step = "trip" | "details" | "done";

const getTripLabel = (trip: DriverTrip) =>
  trip.tripCustomId?.trim() || trip.vehicleIdentifier?.trim() || trip.vehicleName?.trim() || trip.id;

const getTripSubLabel = (trip: DriverTrip) =>
  [trip.customerName?.trim(), formatLagosTime(trip.startDateTime), trip.pickupLocation?.trim()]
    .filter(Boolean)
    .join(" · ") || "Assigned trip";

/** How the trip reads on a draft card: client · time. */
const getDraftTripLabel = (trip: DriverTrip) =>
  [trip.customerName?.trim() || getTripLabel(trip), formatLagosTime(trip.startDateTime)].filter(Boolean).join(" · ");

export default function IncidentReportPage() {
  const router = useRouter();
  const toast = useToast();
  const { isOffline } = useNetworkStatus();
  const driverTripsQuery = useDriverTrips({ page: 0, size: 50 });
  const createIncidentReport = useCreateIncidentReport();
  const [step, setStep] = useState<Step>("trip");
  const [hydrated, setHydrated] = useState(false);
  const [tripId, setTripId] = useState("");
  const [tripLabel, setTripLabel] = useState<string>();
  const [category, setCategory] = useState<IncidentCategory>();
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [isDiscardOpen, setDiscardOpen] = useState(false);
  const capturedFile = useRef<File | null>(null);

  const tripsContent = driverTripsQuery.data?.data.content;
  const trips = useMemo(() => tripsContent ?? [], [tripsContent]);
  const today = toLagosDate(new Date());
  const todayTrips = trips.filter((trip) => (trip.startDateTime ?? "").slice(0, 10) === today);
  const earlierTrips = trips.filter((trip) => (trip.startDateTime ?? "").slice(0, 10) !== today);
  const visibleEarlier = showEarlier ? earlierTrips : [];

  // Pick the draft up where it was left (a saved trip goes straight to the details).
  useEffect(() => {
    const draft = readIncidentDraft();

    if (draft) {
      setTripId(draft.tripId ?? "");
      setTripLabel(draft.tripLabel);
      setCategory(draft.category);
      setDescription(draft.description);
      setImageUrl(draft.photoUrl ?? null);
      setPreviewUrl(draft.photoUrl ?? null);
      if (draft.tripId) setStep("details");
    }

    setHydrated(true);
  }, []);

  const trimmedDescription = description.trim();
  const isSubmitting = createIncidentReport.isPending;
  const missing = !category
    ? "Choose what happened."
    : trimmedDescription.length < MIN_INCIDENT_DESCRIPTION
      ? `Describe what happened (at least ${MIN_INCIDENT_DESCRIPTION} characters).`
      : !imageUrl
        ? "Add a photo of the scene or damage."
        : undefined;
  const canSend = !missing && !isSubmitting && !isUploading && !isOffline;

  const chooseTrip = (trip: DriverTrip) => {
    const label = getDraftTripLabel(trip);

    setTripId(trip.id);
    setTripLabel(label);
    saveIncidentDraft({ tripId: trip.id, tripLabel: label });
    setStep("details");
  };

  const update = <K extends "category" | "description">(key: K, value: K extends "category" ? IncidentCategory : string) => {
    if (key === "category") setCategory(value as IncidentCategory);
    else setDescription(value);

    saveIncidentDraft({ [key]: value });
  };

  const handlePickImage = async () => {
    const captured = await capturePhoto();

    if (!captured) {
      return;
    }

    capturedFile.current = captured.file;
    setPreviewUrl(captured.previewUrl);
    setIsUploading(true);

    try {
      const uploadResult = await uploadChecklistPhoto(captured.file, "incident-report", tripId);

      setImageUrl(uploadResult.fileUrl);
      saveIncidentDraft({ photoUrl: uploadResult.fileUrl });
    } catch (error) {
      setImageUrl(null);
      setPreviewUrl(null);
      toast.error("Upload failed", getApiErrorMessage(error) ?? CHECKLIST_UPLOAD_FAILED_MESSAGE);
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = () => {
    setImageUrl(null);
    setPreviewUrl(null);
    saveIncidentDraft({ photoUrl: undefined });
  };

  const handleSend = async () => {
    if (!canSend || !imageUrl) {
      return;
    }

    try {
      await createIncidentReport.mutateAsync({
        payload: { description: composeDescription(category, trimmedDescription), imageURL: imageUrl },
        tripId,
      });
      clearIncidentDraft();
      setStep("done");
    } catch (error) {
      toast.error("Couldn't send the report", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const discardDraft = () => {
    clearIncidentDraft();
    setDiscardOpen(false);
    setTripId("");
    setTripLabel(undefined);
    setCategory(undefined);
    setDescription("");
    setImageUrl(null);
    setPreviewUrl(null);
    setStep("trip");
  };

  const saveAndFinishLater = () => {
    saveIncidentDraft({ category, description, photoUrl: imageUrl ?? undefined, tripId, tripLabel });
    toast.success("Report saved", "Finish it from Settings → Incident Reports.");
    router.replace("/incident-reports");
  };

  if (step === "done") {
    return (
      <Screen>
        <NavBar left={<BackButton href="/home" />} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <div className="anim-scale-in mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1 className="text-title-1 mb-2 text-text">Incident report submitted</h1>
          <p className="text-body mb-8 text-text-2">Your report has been sent to the operations team.</p>
          <div className="w-full space-y-3">
            <Button onClick={() => router.replace("/home")}>Back to Home</Button>
            <Button variant="outline" onClick={() => router.replace("/incident-reports")}>
              View Your Reports
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (!hydrated) {
    return (
      <Screen>
        <NavBar left={<BackButton />} largeTitle="Incident Report" />
      </Screen>
    );
  }

  if (step === "trip") {
    const renderTrip = (trip: DriverTrip) => (
      <button
        key={trip.id}
        type="button"
        onClick={() => chooseTrip(trip)}
        className="pressable-row hairline-b flex w-full items-center gap-3 px-4 py-3.5 text-left last:border-b-0"
      >
        <span className="min-w-0 flex-1">
          <span className="text-body block truncate font-semibold text-text">{getTripLabel(trip)}</span>
          <span className="text-footnote mt-0.5 block truncate text-text-3">{getTripSubLabel(trip)}</span>
        </span>
        <CheckCircle2 size={18} className={`shrink-0 ${trip.id === tripId ? "text-accent" : "text-transparent"}`} />
      </button>
    );

    return (
      <Screen>
        <NavBar left={<BackButton />} largeTitle="Choose the Trip" subtitle="Step 1 of 2 · Which trip was it on?" />

        <div className="px-5 pb-10">
          {driverTripsQuery.isLoading ? (
            <p className="text-footnote mb-4 text-text-3">Loading trips...</p>
          ) : trips.length === 0 ? (
            <div className="card mb-6 p-4">
              <p className="text-body font-semibold text-text">No trips available</p>
              <p className="text-footnote mt-1 text-text-3">Incident reports need to be attached to a trip.</p>
            </div>
          ) : (
            <>
              {todayTrips.length > 0 && (
                <>
                  <SectionHeader>Today</SectionHeader>
                  <div className="card mb-5 overflow-hidden">{todayTrips.map(renderTrip)}</div>
                </>
              )}
              {visibleEarlier.length > 0 && (
                <>
                  <SectionHeader>Earlier</SectionHeader>
                  <div className="card mb-5 overflow-hidden">{visibleEarlier.map(renderTrip)}</div>
                </>
              )}
              {earlierTrips.length > 0 && !showEarlier && (
                <Button variant="outline" onClick={() => setShowEarlier(true)}>
                  Show Earlier Trips
                </Button>
              )}
            </>
          )}
        </div>
      </Screen>
    );
  }

  const prompt = categoryInfo(category)?.prompt ?? "Describe what happened, where, and who was involved.";

  return (
    <Screen>
      <NavBar
        left={<BackButton onClick={() => setStep("trip")} />}
        largeTitle="What Happened"
        subtitle="Step 2 of 2 · Saved as you go"
      />

      <div className="px-5 pb-10">
        {tripLabel && (
          <button
            type="button"
            onClick={() => setStep("trip")}
            className="card pressable mb-5 flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="text-footnote block text-text-3">The trip this happened on</span>
              <span className="text-body block truncate font-semibold text-text">{tripLabel}</span>
            </span>
            <span className="text-callout font-medium text-accent">Change</span>
          </button>
        )}

        <SectionHeader>What happened</SectionHeader>
        <div className="mb-5 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="What happened">
          {INCIDENT_CATEGORIES.map((item) => {
            const selected = item.value === category;

            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update("category", item.value)}
                className={`pressable rounded-xl border px-3 py-3 text-left text-[15px] font-medium transition-colors ${
                  selected ? "border-accent bg-accent-soft text-accent-text" : "border-border bg-surface text-text"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <SectionHeader>Incident Photo</SectionHeader>
        <PhotoUploadCard
          title={isUploading ? "Uploading..." : "Incident Photo"}
          subtitle="Take a photo of the incident"
          imageUri={previewUrl}
          uploading={isUploading}
          onClick={() => void handlePickImage()}
          onRemove={removePhoto}
        />

        <SectionHeader className="mt-2">Description</SectionHeader>
        <textarea
          value={description}
          onChange={(event) => update("description", event.target.value)}
          placeholder={prompt}
          rows={5}
          className="text-body mb-2 w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-text outline-none placeholder:text-text-4 focus:border-accent focus:shadow-[0_0_0_3px_rgba(6,115,255,0.15)]"
        />

        {isOffline ? (
          <p className="text-footnote mb-4 flex items-center gap-1.5 text-warning-text">
            <WifiOff size={14} /> You&apos;re offline. Your report is saved; send it when you&apos;re back online.
          </p>
        ) : missing ? (
          <p className="text-footnote mb-4 text-text-3">{missing}</p>
        ) : (
          <div className="mb-4" />
        )}

        <div className="space-y-3">
          <Button disabled={!canSend} loading={isSubmitting} onClick={() => void handleSend()}>
            {isSubmitting ? "Sending..." : "Send Report"}
          </Button>
          <Button variant="outline" onClick={saveAndFinishLater}>
            Save and Finish Later
          </Button>
          <button
            type="button"
            onClick={() => setDiscardOpen(true)}
            className="pressable-soft text-callout block w-full py-2 text-center font-medium text-danger"
          >
            Discard Draft
          </button>
        </div>
      </div>

      <AlertDialog
        open={isDiscardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={discardDraft}
        title="Discard this draft?"
        message="The trip, details and photo you added will be removed from this phone."
        confirmText="Discard"
        confirmVariant="danger"
      />
    </Screen>
  );
}
