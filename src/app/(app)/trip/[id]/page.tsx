"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Car, Clock, Phone } from "lucide-react";

import { CallSheet } from "@/components/trips/CallSheet";
import { LocationItem } from "@/components/trips/LocationItem";
import { TimelineTracker } from "@/components/trips/TimelineTracker";
import { BackButton } from "@/components/ui/BackButton";
import { TripBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Divider, NavBar, Screen, SectionHeader } from "@/components/ui/Screen";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useTransitionDriverTripStatus } from "@/lib/api/hooks/usePreRideChecklist";
import { useDriverTrip } from "@/lib/api/hooks/useTrips";
import type { DriverTripDetails, DriverTripLocation, DriverTripStatus } from "@/lib/api/types";
import { getTripBannerMessage, getTripTimeline } from "@/lib/data/tripTimeline";
import { useEnsureTripTracking } from "@/lib/tracking/useTripTracker";
import { getMapsSearchUrl } from "@/lib/utils/deviceActions";
import {
  getDriverTripBookingBadgeLabel,
  getDriverTripBookingTimerType,
  getDriverTripStatusLabel,
  getResolvedDriverTripDetailsStatus,
  type DriverTripBookingTimerType,
} from "@/lib/utils/driverTrips";
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

const getRideTimerConfig = (rideType: DriverTripBookingTimerType) => {
  switch (rideType) {
    case "airport":
      return { label: "Airport Transfer – 4 Hours", totalSeconds: 4 * 60 * 60 };
    case "standard":
      return { label: "Standard – 12 Hours", totalSeconds: 12 * 60 * 60 };
    case "full-day":
      return { label: "Full Day Rental – 24 Hours", totalSeconds: 24 * 60 * 60 };
  }
};

const formatTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

const getRideTimer = (details: DriverTripDetails | undefined, nowMs: number) => {
  const timerType = getDriverTripBookingTimerType(details?.bookingTypeName);
  const fallback = getRideTimerConfig(timerType);
  const startDate = parseApiDate(details?.startDateTime);
  const endDate = parseApiDate(details?.endDateTime);
  const spanSeconds =
    startDate && endDate ? Math.floor((endDate.getTime() - startDate.getTime()) / 1000) : undefined;
  const durationSeconds =
    details?.tripDuration && Number.isFinite(details.tripDuration) && details.tripDuration > 0
      ? Math.round(details.tripDuration * 3600)
      : undefined;
  const totalSeconds = (spanSeconds && spanSeconds > 0 ? spanSeconds : undefined) ?? durationSeconds ?? fallback.totalSeconds;
  const remainingSeconds = endDate
    ? Math.min(totalSeconds, Math.max(0, Math.floor((endDate.getTime() - nowMs) / 1000)))
    : totalSeconds;

  return { label: compact(details?.bookingTypeName) ?? fallback.label, remainingSeconds, totalSeconds };
};

const TimerRing = ({ remainingSeconds, totalSeconds }: { remainingSeconds: number; totalSeconds: number }) => {
  const size = 128;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const offset = circumference * (1 - Math.max(0, Math.min(progress, 1)));

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--fill-strong)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="absolute text-[20px] font-bold tabular-nums text-text">{formatTime(remainingSeconds)}</span>
    </div>
  );
};

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

export default function TripDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tripId = decodeURIComponent(params.id ?? "");
  const driverTripQuery = useDriverTrip(tripId || undefined);
  const transitionDriverTripStatus = useTransitionDriverTripStatus();
  const details = driverTripQuery.data?.data;
  const backendStatus = getResolvedDriverTripDetailsStatus(details);
  useEnsureTripTracking(tripId, backendStatus);

  const stageParam = searchParams.get("stage");
  const status: DriverTripStatus = backendStatus ?? "NOT_STARTED";
  const statusLabel = getDriverTripStatusLabel(status);
  const statusStyle = STATUS_STYLE[statusLabel] ?? DEFAULT_STATUS_STYLE;
  const isRideTimerVisible = status === "ONGOING" || status === "EXTRA_TIME";
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());
  const [isCallSheetOpen, setCallSheetOpen] = useState(false);
  const [isEndRideConfirmVisible, setEndRideConfirmVisible] = useState(false);

  useEffect(() => {
    if (!isRideTimerVisible) return;
    setTimerNowMs(Date.now());
    const interval = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRideTimerVisible]);

  const rideTimer = getRideTimer(details, timerNowMs);
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
        {isRideTimerVisible && (
          <div className="mb-6 flex flex-col items-center">
            <TimerRing remainingSeconds={rideTimer.remainingSeconds} totalSeconds={rideTimer.totalSeconds} />
            <p className="text-footnote mt-4 text-text-3">Time remaining</p>
            <p className="text-headline mt-1 text-text">{rideTimer.label}</p>
          </div>
        )}

        <SectionHeader>Trip Status</SectionHeader>
        <span className={`${statusStyle.badge} inline-flex rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-white uppercase`}>
          {statusLabel}
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
            <Button loading={actionConfig.loading} onClick={actionConfig.onClick}>
              {actionConfig.title}
            </Button>
          </div>
        )}
      </div>

      <CallSheet open={isCallSheetOpen} onClose={() => setCallSheetOpen(false)} phoneNumber={details.customerPhoneNumber} />

      <AlertDialog
        open={isEndRideConfirmVisible}
        onClose={() => setEndRideConfirmVisible(false)}
        onConfirm={() => {
          setEndRideConfirmVisible(false);
          void transition({ nextStatus: "COMPLETE" });
        }}
        title="End this ride?"
        message="This will mark the ride complete and move it out of your active trip cycle."
        confirmText="End Ride"
        confirmVariant="danger"
      />
    </Screen>
  );
}
