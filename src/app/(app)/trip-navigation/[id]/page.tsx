"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Pause, Play } from "lucide-react";

import { END_RIDE_MESSAGE, END_RIDE_TITLE, PauseReasonSheet, RideCounter } from "@/components/trips/RideTimerPanel";
import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Spinner } from "@/components/ui/Spinner";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useRideActions, useTripWithQueuedRideActions } from "@/lib/api/hooks/useRideTimer";
import { useDriverTrip } from "@/lib/api/hooks/useTrips";
import type { DriverTripDetails, DriverTripStatus } from "@/lib/api/types";
import { computeRideClock, isRidingStatus, useServerNow } from "@/lib/rideTimer/rideClock";
import { useEnsureTripTracking } from "@/lib/tracking/useTripTracker";
import { getPhoneUrl, getWhatsAppUrl, openExternalUrl } from "@/lib/utils/deviceActions";
import { getDriverTripStatusLabel, getResolvedDriverTripDetailsStatus } from "@/lib/utils/driverTrips";
import { toMapCoordinate } from "@/lib/utils/geo";
import type { TripNavigationMode } from "@/components/trips/TripNavigationView";
import { useToast } from "@/providers/ToastProvider";

// Leaflet touches `window` at import time, so the map view must skip SSR.
const TripNavigationView = dynamic(
  () => import("@/components/trips/TripNavigationView").then((module) => module.TripNavigationView),
  {
    ssr: false,
    loading: () => <EmptyState loading title="Loading navigation" description="Preparing trip route." />,
  },
);

const compact = (value?: string | null) => value?.trim() || undefined;

const getNavigationMode = ({ mode, status }: { mode?: string | null; status?: DriverTripStatus | null }): TripNavigationMode =>
  mode === "dropoff" || status === "ONGOING" || status === "EXTRA_TIME" ? "dropoff" : "pickup";

const getTripStatusLabel = (mode: TripNavigationMode, tripDetails?: DriverTripDetails) => {
  const resolvedStatus = getResolvedDriverTripDetailsStatus(tripDetails);

  if (mode === "dropoff") {
    if (resolvedStatus === "COMPLETE" || resolvedStatus === "CANCELLED") {
      return getDriverTripStatusLabel(resolvedStatus);
    }

    if (tripDetails?.rideTimer?.paused) {
      return "PAUSED";
    }

    return resolvedStatus === "EXTRA_TIME" ? "EXTRA TIME" : "ONGOING";
  }

  return resolvedStatus ? getDriverTripStatusLabel(resolvedStatus) : "EN ROUTE";
};

export default function TripNavigationPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tripId = decodeURIComponent(params.id ?? "");
  const requestedMode = searchParams.get("mode");
  const driverTripQuery = useDriverTrip(tripId || undefined);
  const rideActions = useRideActions(tripId);
  const { details: tripDetails } = useTripWithQueuedRideActions(tripId, driverTripQuery.data?.data);
  const resolvedTripStatus = getResolvedDriverTripDetailsStatus(tripDetails);
  useEnsureTripTracking(tripId, resolvedTripStatus);
  const navigationMode = getNavigationMode({ mode: requestedMode, status: resolvedTripStatus });
  const rideTimer = tripDetails?.rideTimer;
  const isRiding = isRidingStatus(resolvedTripStatus) && Boolean(rideTimer?.actualStartAt) && !rideTimer?.actualEndAt;
  const nowMs = useServerNow({
    active: isRiding,
    receivedAt: driverTripQuery.dataUpdatedAt,
    serverNow: rideTimer?.serverNow,
  });

  const pickupLat = tripDetails?.pickupLocation?.lat;
  const pickupLng = tripDetails?.pickupLocation?.lng;
  const dropLat = tripDetails?.dropOffLocation?.lat;
  const dropLng = tripDetails?.dropOffLocation?.lng;
  const destination = useMemo(
    () =>
      navigationMode === "pickup"
        ? {
            address: compact(tripDetails?.pickupLocation?.location) ?? "Pickup location unavailable",
            coordinate: toMapCoordinate({ lat: pickupLat, lng: pickupLng }),
          }
        : {
            address: compact(tripDetails?.dropOffLocation?.location) ?? "Drop-off location unavailable",
            coordinate: toMapCoordinate({ lat: dropLat, lng: dropLng }),
          },
    [dropLat, dropLng, navigationMode, pickupLat, pickupLng, tripDetails?.dropOffLocation?.location, tripDetails?.pickupLocation?.location],
  );
  const [isEndRideConfirmVisible, setEndRideConfirmVisible] = useState(false);
  const [isExitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [isPauseSheetOpen, setPauseSheetOpen] = useState(false);
  const customerPhoneNumber = compact(tripDetails?.customerPhoneNumber);

  const navigateBackToTrip = useCallback(() => {
    router.replace(tripId ? `/trip/${encodeURIComponent(tripId)}` : "/trips");
  }, [router, tripId]);

  const startRide = async () => {
    if (!tripId) {
      toast.error("Trip unavailable", "Please go back and select the trip again.");
      return;
    }

    try {
      const result = await rideActions.run("start");

      if (result.ok) {
        router.replace(`/trip-navigation/${encodeURIComponent(tripId)}?mode=dropoff`);
      }
    } catch (error) {
      toast.error("Couldn't start the ride", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const endRide = async () => {
    try {
      const result = await rideActions.run("end");

      if (result.ok) {
        if (!result.queued) {
          toast.success("Ride ended", "Your ride times are on the trip.");
        }
        // The trip screen shows the times and any extra time.
        navigateBackToTrip();
      }
    } catch (error) {
      toast.error("Couldn't end the ride", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  if (!tripId) {
    return (
      <Screen>
        <EmptyState title="Trip unavailable" description="Missing trip ID. Please go back and select the trip again." />
      </Screen>
    );
  }

  if (driverTripQuery.isLoading && !tripDetails) {
    return (
      <Screen>
        <EmptyState loading title="Loading navigation" description="Preparing trip route." />
      </Screen>
    );
  }

  if (driverTripQuery.isError && !tripDetails) {
    return (
      <Screen>
        <EmptyState
          title="Navigation unavailable"
          description={getApiErrorMessage(driverTripQuery.error) ?? "Please check your connection and try again."}
        />
      </Screen>
    );
  }

  if (resolvedTripStatus === "COMPLETE" || resolvedTripStatus === "CANCELLED") {
    return (
      <Screen>
        <EmptyState
          title={resolvedTripStatus === "COMPLETE" ? "Trip complete" : "Trip cancelled"}
          description={resolvedTripStatus === "COMPLETE" ? "This trip has been completed." : "This trip has been cancelled."}
        />
      </Screen>
    );
  }

  const timerSlot =
    isRiding && navigationMode === "dropoff" ? (
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
          <RideCounter clock={computeRideClock(rideTimer, nowMs)} timer={rideTimer} compact />
        </div>
        <button
          type="button"
          disabled={rideActions.pendingAction !== null}
          onClick={() => (rideTimer?.paused ? void rideActions.run("resume") : setPauseSheetOpen(true))}
          className={`pressable flex w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-[20px] border text-[13px] font-semibold ${
            rideTimer?.paused ? "border-accent/30 bg-accent-soft text-accent-text" : "border-border bg-surface text-text"
          }`}
          aria-label={rideTimer?.paused ? "Resume ride" : "Pause ride"}
        >
          {rideActions.pendingAction === "pause" || rideActions.pendingAction === "resume" ? (
            <Spinner size={20} />
          ) : rideTimer?.paused ? (
            <Play size={20} />
          ) : (
            <Pause size={20} />
          )}
          {rideTimer?.paused ? "Resume" : "Pause"}
        </button>
      </div>
    ) : undefined;

  return (
    <>
      <TripNavigationView
        destinationAddress={destination.address}
        destinationCoordinate={destination.coordinate}
        mode={navigationMode}
        onBack={() => setExitConfirmVisible(true)}
        onCall={() => {
          const url = getPhoneUrl(customerPhoneNumber);
          if (!url) {
            toast.error("Phone number unavailable", "Please contact support if you need the client phone number.");
            return;
          }
          window.location.href = url;
        }}
        onWhatsapp={() => {
          const url = getWhatsAppUrl(customerPhoneNumber);
          if (!url) {
            toast.error("Phone number unavailable", "Please contact the client by regular call.");
            return;
          }
          openExternalUrl(url);
        }}
        onEndRide={() => setEndRideConfirmVisible(true)}
        onStartRide={() => void startRide()}
        primaryActionLoading={rideActions.pendingAction === "start" || rideActions.pendingAction === "end"}
        statusLabel={getTripStatusLabel(navigationMode, tripDetails)}
        timerSlot={timerSlot}
      />

      <PauseReasonSheet
        open={isPauseSheetOpen}
        onClose={() => setPauseSheetOpen(false)}
        loading={rideActions.pendingAction === "pause"}
        onConfirm={(reason, note) => {
          setPauseSheetOpen(false);
          void rideActions.run("pause", { reason, note });
        }}
      />

      <AlertDialog
        open={isEndRideConfirmVisible}
        onClose={() => setEndRideConfirmVisible(false)}
        onConfirm={() => {
          setEndRideConfirmVisible(false);
          void endRide();
        }}
        title={END_RIDE_TITLE}
        message={END_RIDE_MESSAGE}
        confirmText="End ride"
        confirmVariant="danger"
      />

      <AlertDialog
        open={isExitConfirmVisible}
        onClose={() => setExitConfirmVisible(false)}
        onConfirm={() => {
          setExitConfirmVisible(false);
          navigateBackToTrip();
        }}
        title="Exit navigation?"
        message={
          navigationMode === "pickup"
            ? "You can return to pickup navigation from this trip while pickup is still active."
            : "You can return to drop-off navigation from this trip while the ride is still active."
        }
        cancelText="Stay on map"
        confirmText="Exit navigation"
      />
    </>
  );
}
