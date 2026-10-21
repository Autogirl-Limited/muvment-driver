"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useTransitionDriverTripStatus } from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrip } from "@/lib/api/hooks/useTrips";
import type { DriverTripDetails, DriverTripStatus } from "@/lib/api/types";
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
    return resolvedStatus === "COMPLETE" || resolvedStatus === "CANCELLED"
      ? getDriverTripStatusLabel(resolvedStatus)
      : "ONGOING";
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
  const transitionDriverTripStatus = useTransitionDriverTripStatus();
  const tripDetails = driverTripQuery.data?.data;
  const resolvedTripStatus = getResolvedDriverTripDetailsStatus(tripDetails);
  useEnsureTripTracking(tripId, resolvedTripStatus);
  const navigationMode = getNavigationMode({ mode: requestedMode, status: resolvedTripStatus });

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
  const customerPhoneNumber = compact(tripDetails?.customerPhoneNumber);

  const navigateBackToTrip = useCallback(() => {
    router.replace(tripId ? `/trip/${encodeURIComponent(tripId)}` : "/trips");
  }, [router, tripId]);

  const transitionStatus = async (nextStatus: DriverTripStatus, nextMode?: TripNavigationMode) => {
    if (!tripId) {
      toast.error("Trip unavailable", "Please go back and select the trip again.");
      return;
    }

    try {
      await transitionDriverTripStatus.mutateAsync({ driverTripStatus: nextStatus, tripId });

      if (nextStatus === "COMPLETE") {
        toast.success("Ride completed", "The trip has been marked complete.");
        router.replace("/home");
        return;
      }

      if (nextMode) {
        router.replace(`/trip-navigation/${encodeURIComponent(tripId)}?mode=${nextMode}`);
      }
    } catch (error) {
      toast.error("Status update failed", getApiErrorMessage(error) ?? "Please try again.");
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
        onStartRide={() => void transitionStatus("ONGOING", "dropoff")}
        primaryActionLoading={transitionDriverTripStatus.isPending}
        statusLabel={getTripStatusLabel(navigationMode, tripDetails)}
      />

      <AlertDialog
        open={isEndRideConfirmVisible}
        onClose={() => setEndRideConfirmVisible(false)}
        onConfirm={() => {
          setEndRideConfirmVisible(false);
          void transitionStatus("COMPLETE");
        }}
        title="End this ride?"
        message="This will mark the ride complete and move it out of your active trip cycle."
        confirmText="End Ride"
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
