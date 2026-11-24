"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDashboardReading, useStartDashboardReading } from "@/lib/api/hooks/useChecklistAi";
import type { ChecklistType, DashboardReading, VehicleMetadata } from "@/lib/api/types";

/** After this long the driver is offered manual entry while the server is still reading. */
const READING_SLOW_AFTER_MS = 20_000;

const toText = (value: number | null | undefined) => (typeof value === "number" ? String(value) : "");

/**
 * The dashboard reading, the way the mobile app does it: the server reads the
 * odometer and fuel from the dashboard photo in the background as soon as the
 * photo is uploaded, and the readings fields fill in when it is done. Nothing
 * waits on the submit request. The driver can type their own values at any
 * time; once they have, the reading never overwrites them.
 */
export const useDashboardReadingFlow = ({
  checklistType,
  dashboardUploading,
  dashboardUrl,
  hasSavedSubmission,
  savedMetadata,
  trackerId,
}: {
  checklistType: ChecklistType;
  dashboardUploading: boolean;
  /** Address of the dashboard photo on screen, once it is uploaded. */
  dashboardUrl?: string;
  /** The interior is already saved on the server (a resumed report). */
  hasSavedSubmission: boolean;
  savedMetadata?: VehicleMetadata | null;
  trackerId?: string;
}) => {
  const [odometer, setOdometerText] = useState("");
  const [fuelLevel, setFuelLevelText] = useState("");
  const [appliedReadingId, setAppliedReadingId] = useState<string>();
  // Which photo the driver typed readings for: a retake starts fresh.
  const [typedFor, setTypedFor] = useState<string>();
  const manualKey = dashboardUrl ?? "saved";
  const typedByDriver = typedFor === manualKey;

  const startReading = useStartDashboardReading();
  const readingQuery = useDashboardReading(trackerId, checklistType, dashboardUrl, {
    enabled: Boolean(trackerId) && (Boolean(dashboardUrl) || hasSavedSubmission),
  });
  // Only the reading of the photo on screen counts; an older photo's is ignored.
  const reading: DashboardReading | undefined =
    readingQuery.data && (!dashboardUrl || readingQuery.data.imageUrl === dashboardUrl) ? readingQuery.data : undefined;

  const setOdometer = useCallback(
    (value: string) => {
      setTypedFor(manualKey);
      setOdometerText(value);
    },
    [manualKey],
  );
  const setFuelLevel = useCallback(
    (value: string) => {
      setTypedFor(manualKey);
      setFuelLevelText(value);
    },
    [manualKey],
  );
  /** "Enter manually": stop waiting for the reading and keep the driver's own values. */
  const takeOver = useCallback(() => setTypedFor(manualKey), [manualKey]);

  // A resumed report: show what was saved, and keep it over any newer reading.
  const savedFilledRef = useRef(false);
  useEffect(() => {
    if (savedFilledRef.current || dashboardUrl || !hasSavedSubmission || !savedMetadata) return;
    savedFilledRef.current = true;
    setOdometerText(toText(savedMetadata.odometerKM));
    setFuelLevelText(toText(savedMetadata.fuelLevelInPercentage));
    setTypedFor("saved");
  }, [dashboardUrl, hasSavedSubmission, savedMetadata]);

  // When the reading of the photo on screen finishes, its values fill the fields
  // (a retake brings new values), unless the driver typed their own meanwhile.
  useEffect(() => {
    if (!reading || reading.status === "PROCESSING" || reading.id === appliedReadingId) return;

    setAppliedReadingId(reading.id);
    if (typedByDriver) return;

    if (reading.status === "COMPLETED") {
      setOdometerText(toText(reading.odometerKm));
      setFuelLevelText(toText(reading.fuelPercent));
    } else {
      setOdometerText("");
      setFuelLevelText("");
    }
  }, [appliedReadingId, reading, typedByDriver]);

  // A dashboard photo with no reading yet (the report was resumed, or the
  // upload finished before anything asked for one): start one, once per photo.
  const startedFor = useRef<string | undefined>(undefined);
  const { mutate: startMutate } = startReading;
  useEffect(() => {
    if (
      !trackerId ||
      !dashboardUrl ||
      reading ||
      !readingQuery.isFetched ||
      readingQuery.isFetching ||
      startedFor.current === dashboardUrl
    ) {
      return;
    }
    startedFor.current = dashboardUrl;
    startMutate({ checklistType, imageUrl: dashboardUrl, trackerId });
  }, [checklistType, dashboardUrl, reading, readingQuery.isFetched, readingQuery.isFetching, startMutate, trackerId]);

  const retry = useCallback(() => {
    if (!trackerId || !dashboardUrl) return;
    setTypedFor(undefined);
    startReading.mutate({ checklistType, force: true, imageUrl: dashboardUrl, trackerId });
  }, [checklistType, dashboardUrl, startReading, trackerId]);

  const isReadingPending =
    !typedByDriver &&
    (dashboardUploading ||
      reading?.status === "PROCESSING" ||
      (Boolean(dashboardUrl) &&
        !reading &&
        !startReading.isError &&
        !readingQuery.isError &&
        (startReading.isPending || readingQuery.isLoading || readingQuery.isFetching || startedFor.current !== dashboardUrl)));
  const failed = Boolean(dashboardUrl) && !typedByDriver && (reading?.status === "FAILED" || startReading.isError);

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isReadingPending) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), READING_SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [isReadingPending]);

  return { failed, fuelLevel, isReadingPending, odometer, reading, retry, setFuelLevel, setOdometer, slow, takeOver };
};
