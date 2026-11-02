"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Car, Clock, Phone, Wallet } from "lucide-react";

import { CallSheet } from "@/components/trips/CallSheet";
import { LocationItem } from "@/components/trips/LocationItem";
import { AutoStartCountdown, RideTimerPanel, useAutoStartCountdown } from "@/components/trips/RideTimerPanel";
import { TimelineTracker } from "@/components/trips/TimelineTracker";
import { BackButton } from "@/components/ui/BackButton";
import { TripBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Divider, NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useTransitionDriverTripStatus } from "@/lib/api/hooks/usePreRideChecklist";
import { useRideActions, useTripWithQueuedRideActions } from "@/lib/api/hooks/useRideTimer";
import { useDriverTrip } from "@/lib/api/hooks/useTrips";
import type { DriverTripLocation, DriverTripStatus } from "@/lib/api/types";
import { computeRideClock, isPreRideStatus, isRidingStatus, useServerNow } from "@/lib/rideTimer/rideClock";
import { getTripBannerMessage, getTripTimeline } from "@/lib/data/tripTimeline";
import { useEnsureTripTracking } from "@/lib/tracking/useTripTracker";
import { getMapsSearchUrl } from "@/lib/utils/deviceActions";
import {
  getDriverTripBookingBadgeLabel,
  getDriverTripStatusLabel,
  getResolvedDriverTripDetailsStatus,
} from "@/lib/utils/driverTrips";
import { parseLagosMs } from "@/lib/utils/lagosTime";
import { useToast } from "@/providers/ToastProvider";

const compact = (value?: string | null) => value?.trim() || undefined;

const parseApiDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const formatDateLabel = (value?: string | null) => {
  const date = parseApiDate(value);
  return date ? dateFormatter.format(date) : undefined;
};

const formatScheduleLabel = (startValue?: string | null, endValue?: string | null) => {
  const startDate = parseApiDate(startValue);
  const endDate = parseApiDate(endValue);
  if (!startDate || !endDate) return undefined;
  return `${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;
};

const formatDurationLabel = (duration?: number | null) =>
  duration === undefined || duration === null ? undefined : `${duration} hr${duration === 1 ? "" : "s"}`;

const STATUS_STYLE: Record<string, { banner: string; badge: string }> = {
  "CHECKED IN": { banner: "bg-[#0A8F2A]", badge: "bg-success" },
  "AWAITING PICKUP": { banner: "bg-[#F97316]", badge: "bg-[#F97316]" },
  "RUNNING LATE": { banner: "bg-[#DC2626]", badge: "bg-danger" },
  ONGOING: { banner: "bg-[#0A8F2A]", badge: "bg-success" },
  "EXTRA TIME": { banner: "bg-[#0A8F2A]", badge: "bg-success" },
  COMPLETE: { banner: "bg-text-3", badge: "bg-text-3" },
  CANCELLED: { banner: "bg-[#DC2626]", badge: "bg-danger" },
};
const DEFAULT_STATUS_STYLE = { banner: "bg-[#DC2626]", badge: "bg-[#EAB308]" };

const getLocationAddress = (location?: DriverTripLocation | null) => compact(location?.location);

/** While the server may auto-start a ride (booked start passed, not started), poll for it. */
const AUTO_START_POLL_MS = 10_000;
const AUTO_START_POLL_WINDOW_MS = 3 * 60 * 60_000;

export default function TripDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tripId = decodeURIComponent(params.id ?? "");
  const [pollForAutoStart, setPollForAutoStart] = useState(false);
  const driverTripQuery = useDriverTrip(tripId || undefined, {
    refetchInterval: pollForAutoStart ? AUTO_START_POLL_MS : false,
  });
  const transitionDriverTripStatus = useTransitionDriverTripStatus();
  const rideActions = useRideActions(tripId);
  // Ride actions saved offline are shown as if already applied.
  const { details, pendingCount } = useTripWithQueuedRideActions(tripId, driverTripQuery.data?.data);
  const backendStatus = getResolvedDriverTripDetailsStatus(details);
  useEnsureTripTracking(tripId, backendStatus);

  const stageParam = searchParams.get("stage");
  const status: DriverTripStatus = backendStatus ?? "NOT_STARTED";
  const rideTimer = details?.rideTimer;
  const autoStarted = rideTimer?.startMethod === "AUTO" && isRidingStatus(status);
  const statusLabel = getDriverTripStatusLabel(status);
  const statusStyle = STATUS_STYLE[statusLabel] ?? DEFAULT_STATUS_STYLE;
  const [isCallSheetOpen, setCallSheetOpen] = useState(false);

  const nowMs = useServerNow({
    active: status !== "COMPLETE" && status !== "CANCELLED",
    receivedAt: driverTripQuery.dataUpdatedAt,
    serverNow: rideTimer?.serverNow,
  });
  const clock = computeRideClock(rideTimer, nowMs);
  const bookedStartMs = parseLagosMs(rideTimer?.bookedStartAt);
  const shouldPoll =
    isPreRideStatus(status) &&
    !rideTimer?.actualStartAt &&
    bookedStartMs !== undefined &&
    nowMs >= bookedStartMs &&
    nowMs - bookedStartMs < AUTO_START_POLL_WINDOW_MS;

  if (shouldPoll !== pollForAutoStart) {
    setPollForAutoStart(shouldPoll);
  }

  const refetchTrip = driverTripQuery.refetch;
  const handleReachedStart = useCallback(() => {
    // The server sweep starts the ride; give it a moment, then look.
    window.setTimeout(() => void refetchTrip(), 2_000);
  }, [refetchTrip]);
  const countdown = useAutoStartCountdown({ clock, status, onReachedStart: handleReachedStart });
  const pickupAddress = getLocationAddress(details?.pickupLocation) ?? "Pickup location unavailable";
  const dropOffAddress = getLocationAddress(details?.dropOffLocation) ?? "Drop-off location unavailable";
  const bookingType = compact(details?.driverOwnerType);
  const rentalType = getDriverTripBookingBadgeLabel(details?.bookingTypeName);
  const itinerary = [
    getLocationAddress(details?.pickupLocation) ? `Pickup at ${getLocationAddress(details?.pickupLocation)}` : undefined,
    getLocationAddress(details?.dropOffLocation) ? `Drop off at ${getLocationAddress(details?.dropOffLocation)}` : undefined,
  ].filter((item): item is string => Boolean(item));
  const tripRef = compact(details?.tripCustomId) ?? details?.id ?? tripId;
  const timeline = getTripTimeline(status);
  const bannerMessage = getTripBannerMessage(status);

  const navigateToTrips = () => router.replace("/trips");

  const transition = async ({
    nextStatus,
    openNavigation,
  }: {
    nextStatus: DriverTripStatus;
    openNavigation?: "pickup" | "dropoff";
  }) => {
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

      if (openNavigation) {
        router.replace(`/trip-navigation/${encodeURIComponent(tripId)}?mode=${openNavigation}`);
      }
    } catch (error) {
      toast.error("Status update failed", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const openNavigation = (mode: "pickup" | "dropoff") =>
    router.push(`/trip-navigation/${encodeURIComponent(tripId)}?mode=${mode}`);

  const startRide = async () => {
    const result = await rideActions.run("start");
    if (result.ok) {
      router.replace(`/trip-navigation/${encodeURIComponent(tripId)}?mode=dropoff`);
    }
  };

  const endRide = async () => {
    const result = await rideActions.run("end");
    if (result.ok && !result.queued) {
      toast.success("Ride ended", "Your ride times are shown below.");
    }
  };

  const actionConfig = (() => {
    const pending = transitionDriverTripStatus.isPending;

    switch (status) {
      case "CHECKED_IN":
        return {
          title: pending ? "Updating..." : "Proceed to Pickup",
          loading: pending,
          onClick: () => void transition({ nextStatus: "AWAITING_PICKUP", openNavigation: "pickup" }),
        };
      case "AWAITING_PICKUP":
      case "RUNNING_LATE":
        return { title: "Return to Pickup Navigation", loading: false, onClick: () => openNavigation("pickup") };
      case "ONGOING":
      case "EXTRA_TIME":
        return { title: "Return to Drop-off Navigation", loading: false, onClick: () => openNavigation("dropoff") };
      case "COMPLETE":
        return {
          title: "Request payment",
          loading: false,
          icon: <Wallet size={18} />,
          onClick: () => router.push(`/payments/new?tripId=${encodeURIComponent(tripId)}`),
        };
      case "CANCELLED":
        return null;
      default:
        return {
          title: pending ? "Updating..." : "Check In",
          loading: pending,
          onClick: () => void transition({ nextStatus: "CHECKED_IN" }),
        };
    }
  })();

  if (!tripId) {
    return (
      <Screen>
        <NavBar left={<BackButton onClick={navigateToTrips} />} />
        <EmptyState title="Trip unavailable" description="Missing trip ID. Please go back and select a trip again." />
      </Screen>
    );
  }

  if (driverTripQuery.isLoading && !details) {
    return (
      <Screen>
        <NavBar left={<BackButton onClick={navigateToTrips} />} />
        <EmptyState loading title="Loading trip" description="Fetching trip details." />
      </Screen>
    );
  }

  if (driverTripQuery.isError || !details) {
    return (
      <Screen>
        <NavBar left={<BackButton onClick={navigateToTrips} />} />
        <EmptyState
          title="Unable to load trip"
          description={getApiErrorMessage(driverTripQuery.error) ?? "Please check your connection and try again."}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar left={<BackButton onClick={navigateToTrips} />} title={tripRef} />

      {status !== "COMPLETE" && (
        <div className={`${statusStyle.banner} px-4 py-2.5 text-center text-[14px] font-medium text-white`}>
          {bannerMessage}
        </div>
      )}

      <div className="anim-rise-in px-5 pt-5 pb-10" style={{ animationDelay: `${stageParam ? 0 : 40}ms` }}>
        <RideTimerPanel
          status={status}
          timer={rideTimer}
          nowMs={nowMs}
          pendingCount={pendingCount}
          pendingAction={rideActions.pendingAction}
          showStart={status !== "NOT_STARTED"}
          onStart={() => void startRide()}
          onPause={(reason, note) => rideActions.run("pause", { reason, note })}
          onResume={() => void rideActions.run("resume")}
          onEnd={() => void endRide()}
        />

        <SectionHeader>Trip Status</SectionHeader>
        <span className={`${statusStyle.badge} inline-flex rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-white uppercase`}>
          {autoStarted ? `${statusLabel} (auto-started)` : statusLabel}
        </span>

        <Divider className="my-4" />

        <SectionHeader>Trip Timeline</SectionHeader>
        <TimelineTracker steps={timeline} />

        <Divider className="my-2 mb-4" />

        <SectionHeader>Client</SectionHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body font-medium text-text">{compact(details.customerName) ?? "Customer"}</p>
            <p className="text-callout mt-0.5 text-text-3">{compact(details.customerPhoneNumber) ?? "Phone unavailable"}</p>
          </div>
          <button
            type="button"
            onClick={() => setCallSheetOpen(true)}
            disabled={!compact(details.customerPhoneNumber)}
            className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success disabled:opacity-40"
            aria-label="Call client"
          >
            <Phone size={18} />
          </button>
        </div>

        <Divider className="my-4" />

        <LocationItem
          title="Pickup Location"
          address={pickupAddress}
          mapsUrl={getMapsSearchUrl({
            address: getLocationAddress(details.pickupLocation),
            lat: details.pickupLocation?.lat,
            lng: details.pickupLocation?.lng,
          })}
        />

        <Divider className="my-4" />

        <LocationItem
          title="Drop-Off Location"
          address={dropOffAddress}
          mapsUrl={getMapsSearchUrl({
            address: getLocationAddress(details.dropOffLocation),
            lat: details.dropOffLocation?.lat,
            lng: details.dropOffLocation?.lng,
          })}
        />

        <Divider className="my-4" />

        <SectionHeader>Vehicle</SectionHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-surface-alt text-text-2">
            <Car size={24} />
          </span>
          <div>
            <p className="text-body font-medium text-text">{compact(details.vehicleName) ?? "Vehicle unavailable"}</p>
            <p className="text-footnote mt-0.5 text-text-3">{compact(details.vehicleIdentifier) ?? "—"}</p>
          </div>
        </div>

        <Divider className="my-4" />

        <SectionHeader>Booking</SectionHeader>
        <div className="mb-4 flex flex-wrap gap-2">
          {bookingType && <TripBadge label={bookingType} type="owner" />}
          {rentalType && <TripBadge label={rentalType} type="booking" />}
        </div>
        <dl className="space-y-2.5">
          {[
            { icon: CalendarDays, label: "Date", value: formatDateLabel(details.startDateTime) },
            { icon: Clock, label: "Duration", value: formatDurationLabel(details.tripDuration) },
            { icon: CalendarDays, label: "Schedule", value: formatScheduleLabel(details.startDateTime, details.endDateTime) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-callout flex items-center gap-2 text-text-3">
              <Icon size={15} className="text-text-4" />
              <dt>{label}:</dt>
              <dd className="font-medium text-text">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>

        {itinerary.length > 0 && (
          <>
            <Divider className="my-4" />
            <SectionHeader>Itinerary</SectionHeader>
            <ol className="space-y-3">
              {itinerary.map((item, index) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-alt text-[10px] font-semibold text-text-2">
                    {index + 1}
                  </span>
                  <span className="text-callout flex-1 text-text-2">{item}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {actionConfig && (
          <div className="mt-8">
            <Button
              loading={actionConfig.loading}
              onClick={actionConfig.onClick}
              icon={"icon" in actionConfig ? actionConfig.icon : undefined}
            >
              {actionConfig.title}
            </Button>
          </div>
        )}
      </div>

      <CallSheet open={isCallSheetOpen} onClose={() => setCallSheetOpen(false)} phoneNumber={details.customerPhoneNumber} />
      {countdown !== null && <AutoStartCountdown seconds={countdown} />}

    </Screen>
  );
}
