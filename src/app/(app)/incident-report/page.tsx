"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2 } from "lucide-react";

import { PhotoUploadCard } from "@/components/checklist/PhotoUploadCard";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCreateIncidentReport, useDriverTrips } from "@/lib/api/hooks/useTrips";
import type { DriverTrip } from "@/lib/api/types";
import { capturePhoto } from "@/lib/utils/deviceActions";
import { CHECKLIST_UPLOAD_FAILED_MESSAGE, uploadChecklistPhoto } from "@/lib/utils/mediaUpload";
import { useToast } from "@/providers/ToastProvider";

const getTripLabel = (trip: DriverTrip) =>
  trip.tripCustomId?.trim() || trip.vehicleIdentifier?.trim() || trip.vehicleName?.trim() || trip.id;

const getTripSubLabel = (trip: DriverTrip) =>
  [trip.customerName?.trim(), trip.pickupLocation?.trim()].filter(Boolean).join(" • ") || "Assigned trip";

export default function IncidentReportPage() {
  const router = useRouter();
  const toast = useToast();
  const driverTripsQuery = useDriverTrips({ page: 0, size: 50 });
  const [selectedTripId, setSelectedTripId] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const capturedFile = useRef<File | null>(null);
  const createIncidentReport = useCreateIncidentReport();
  const tripsContent = driverTripsQuery.data?.data.content;
  const trips = useMemo(() => tripsContent ?? [], [tripsContent]);
  const isSubmitting = createIncidentReport.isPending || isUploading;
  const canSubmit = Boolean(selectedTripId) && Boolean(imageUrl) && description.trim().length > 0 && !isSubmitting;

  useEffect(() => {
    if (!selectedTripId && trips[0]?.id) {
      setSelectedTripId(trips[0].id);
    }
  }, [selectedTripId, trips]);

  const selectedTripLabel = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId),
    [selectedTripId, trips],
  );

  const handlePickImage = async () => {
    if (!selectedTripId) {
      toast.error("Select a trip", "Choose the trip this incident belongs to first.");
      return;
    }

    const captured = await capturePhoto();

    if (!captured) {
      return;
    }

    capturedFile.current = captured.file;
    setPreviewUrl(captured.previewUrl);
    setIsUploading(true);

    try {
      const uploadResult = await uploadChecklistPhoto(captured.file, "incident-report", selectedTripId);
      setImageUrl(uploadResult.fileUrl);
    } catch (error) {
      setPreviewUrl(null);
      toast.error("Upload failed", getApiErrorMessage(error) ?? CHECKLIST_UPLOAD_FAILED_MESSAGE);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !imageUrl) {
      return;
    }

    try {
      await createIncidentReport.mutateAsync({
        payload: { description: description.trim(), imageURL: imageUrl },
        tripId: selectedTripId,
      });
      setDescription("");
      setImageUrl(null);
      setPreviewUrl(null);
      setIsSubmitted(true);
    } catch (error) {
      toast.error("Submission failed", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  if (isSubmitted) {
    return (
      <Screen>
        <NavBar left={<BackButton href="/home" />} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <div className="anim-scale-in mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <Check size={30} strokeWidth={3} />
          </div>
          <h1 className="text-title-1 mb-2 text-text">Incident report submitted</h1>
          <p className="text-body mb-8 text-text-2">Your report has been sent to the operations team.</p>
          <Button onClick={() => router.replace("/home")}>Back to Home</Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar left={<BackButton />} largeTitle="Incident Report" subtitle="Capture an incident image and description for the selected trip." />

      <div className="px-5 pb-10">
        <SectionHeader>Trip</SectionHeader>
        {driverTripsQuery.isLoading ? (
          <p className="text-footnote mb-4 text-text-3">Loading trips...</p>
        ) : trips.length === 0 ? (
          <div className="card mb-6 p-4">
            <p className="text-body font-semibold text-text">No trips available</p>
            <p className="text-footnote mt-1 text-text-3">Incident reports need to be attached to a trip.</p>
          </div>
        ) : (
          <div className="scrollbar-none -mx-5 mb-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {trips.map((trip) => {
              const isSelected = trip.id === selectedTripId;

              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`card pressable w-[220px] shrink-0 p-4 text-left transition-colors ${
                    isSelected ? "border-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-body truncate font-semibold text-text">{getTripLabel(trip)}</p>
                      <p className="text-caption mt-1 line-clamp-2 text-text-3">{getTripSubLabel(trip)}</p>
                    </div>
                    {isSelected && <CheckCircle2 size={18} className="shrink-0 text-accent" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <SectionHeader>Incident Image</SectionHeader>
        <PhotoUploadCard
          title={isUploading ? "Uploading..." : "Incident Photo"}
          subtitle={selectedTripLabel ? "Capture a clear photo of the incident" : "Select a trip first"}
          imageUri={previewUrl}
          uploading={isUploading}
          onClick={() => void handlePickImage()}
          onRemove={() => {
            setImageUrl(null);
            setPreviewUrl(null);
          }}
        />

        <SectionHeader className="mt-2">Description</SectionHeader>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what happened"
          rows={5}
          className="text-body mb-6 w-full rounded-2xl border border-border-strong bg-surface px-4 py-3 text-text outline-none placeholder:text-text-4 focus:border-accent focus:shadow-[0_0_0_3px_rgba(6,115,255,0.15)]"
        />

        <Button disabled={!canSubmit} loading={isSubmitting} onClick={() => void handleSubmit()}>
          {isSubmitting ? "Submitting..." : "Submit Incident Report"}
        </Button>
      </div>
    </Screen>
  );
}
