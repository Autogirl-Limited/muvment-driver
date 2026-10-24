"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ChevronLeft, Flag, MapPin, Maximize2, Navigation, Phone } from "lucide-react";

import { fetchGoogleDrivingRoute, isGoogleRoutesConfigured, type GoogleRouteResult } from "@/lib/api/googleRoutes";
import { useTripTracker } from "@/lib/tracking/useTripTracker";
import { getMapsDirectionsUrl } from "@/lib/utils/deviceActions";
import { getDistanceMeters, getLinearRouteCoordinates, isValidCoordinate, type MapCoordinate } from "@/lib/utils/geo";
import { formatArrivalTime, formatRouteDistance, formatRouteDuration } from "@/lib/utils/tripRouteFormat";
import { useTheme } from "@/providers/ThemeProvider";
import { Spinner } from "@/components/ui/Spinner";
import { WhatsAppIcon } from "./CallSheet";
import { createDriverCarIcon } from "./driverCarIcon";

export type TripNavigationMode = "pickup" | "dropoff";

type TripNavigationViewProps = {
  destinationAddress: string;
  destinationCoordinate: MapCoordinate | null;
  mode: TripNavigationMode;
  onArrived?: () => void;
  onBack: () => void;
  onCall?: () => void;
  onEndRide?: () => void;
  onStartRide?: () => void;
  onWhatsapp?: () => void;
  primaryActionLoading?: boolean;
  statusLabel: string;
};

type PermissionState = "checking" | "granted" | "denied";
type CameraMode = "follow" | "overview" | "free";
type DriverFix = MapCoordinate & { heading: number | null; speed: number | null; timestamp: number };

const DEFAULT_CENTER: MapCoordinate = { latitude: 6.5244, longitude: 3.3792 };
const MIN_ROUTE_REFRESH_DISTANCE_METERS = 75;
const FALLBACK_SPEED_METERS_PER_SECOND = 8.3;
const ARRIVAL_NUDGE_METERS = 150;

// OpenStreetMap's public tiles need no key. Dark mode applies a CSS night filter to the
// tile pane (see globals.css) instead of a separate dark tile set.
const TILES_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const toLatLng = (coordinate: MapCoordinate): [number, number] => [coordinate.latitude, coordinate.longitude];

const getFallbackRoute = ({
  destination,
  origin,
}: {
  destination: MapCoordinate | null;
  origin: MapCoordinate | null;
}): GoogleRouteResult | null => {
  if (!origin || !destination) {
    return null;
  }
  const estimatedDistanceMeters = getDistanceMeters(origin, destination) * 1.35;
  return {
    distanceMeters: estimatedDistanceMeters,
    durationSeconds: estimatedDistanceMeters / FALLBACK_SPEED_METERS_PER_SECOND,
    polylineCoordinates: getLinearRouteCoordinates(origin, destination),
  };
};

const bearing = (a: MapCoordinate, b: MapCoordinate) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/** Drops the part of the route already behind the car, so the line shrinks as you drive. */
const remainingRoute = (route: MapCoordinate[], car: MapCoordinate | null) => {
  if (!car || route.length < 2) {
    return route;
  }
  let nearest = 0;
  let best = Infinity;
  route.forEach((point, index) => {
    const d = getDistanceMeters(point, car);
    if (d < best) {
      best = d;
      nearest = index;
    }
  });
  return best > 250 ? route : [car, ...route.slice(nearest + 1)];
};

const shortPlace = (address: string) => address.split(",")[0]?.trim() || address;

const formatWaitingTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ markers */
const createDestinationIcon = ({
  mode,
  title,
  subtitle,
  night,
}: {
  mode: TripNavigationMode;
  title: string;
  subtitle: string;
  night: boolean;
}) => {
  const pickup = mode === "pickup";
  const color = pickup ? "#0673FF" : "#101928";
  const chipBg = night ? "rgba(17,24,39,0.92)" : "rgba(255,255,255,0.94)";
  const chipText = night ? "#F8FAFC" : "#101928";
  const chipSub = night ? "#A6B3C8" : "#667185";
  const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

  return L.divIcon({
    className: "leaflet-div-icon",
    iconSize: [220, 76],
    iconAnchor: [110, 76],
    html: `<div style="display:flex;flex-direction:column;align-items:center;width:220px;">
      <div style="max-width:220px;background:${chipBg};border:1px solid rgba(16,25,40,0.08);border-radius:12px;padding:6px 11px;box-shadow:0 4px 10px rgba(16,25,40,0.16);font-family:inherit;">
        <div style="color:${chipText};font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escape(title)}</div>
        <div style="color:${chipSub};font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escape(subtitle)}</div>
      </div>
      <div style="width:2px;height:8px;background:${color};opacity:.5;"></div>
      <div style="width:24px;height:24px;border-radius:${pickup ? "12px" : "8px"};background:${color};border:4px solid #fff;box-shadow:0 2px 6px rgba(16,25,40,0.3);"></div>
    </div>`,
  });
};

/* ------------------------------------------------------------------ map helpers */
const MapCamera = ({
  cameraMode,
  driverCoordinate,
  overview,
  onUserPan,
}: {
  cameraMode: CameraMode;
  driverCoordinate: MapCoordinate | null;
  overview: MapCoordinate[];
  onUserPan: () => void;
}) => {
  const map = useMap();

  useMapEvents({
    dragstart: onUserPan,
  });

  useEffect(() => {
    if (cameraMode === "follow" && driverCoordinate) {
      map.panTo(toLatLng(driverCoordinate), { animate: true, duration: 0.8 });
      if (map.getZoom() < 15) {
        map.setZoom(16);
      }
    }
  }, [cameraMode, driverCoordinate?.latitude, driverCoordinate?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cameraMode === "overview" && overview.length >= 2) {
      map.fitBounds(L.latLngBounds(overview.map(toLatLng)), { padding: [60, 60], animate: true });
    } else if (cameraMode === "overview" && overview.length === 1) {
      map.setView(toLatLng(overview[0]), 15);
    }
  }, [cameraMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Leaflet needs a nudge after the container animates in.
    const id = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(id);
  }, [map]);

  return null;
};

const PulseDot = ({ color }: { color: string }) => (
  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
    <span className="absolute h-2.5 w-2.5 rounded-full" style={{ background: color, animation: "pulse-ring 1.6s ease-out infinite" }} />
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
  </span>
);

/* ------------------------------------------------------------------ the view */
export const TripNavigationView = ({
  destinationAddress,
  destinationCoordinate,
  mode,
  onArrived,
  onBack,
  onCall,
  onEndRide,
  onStartRide,
  onWhatsapp,
  primaryActionLoading,
  statusLabel,
}: TripNavigationViewProps) => {
  const { isDark } = useTheme();
  const tracker = useTripTracker();
  const trackerSharing = tracker.status === "sharing" && tracker.lastFix !== null;
  const lastRouteOriginRef = useRef<MapCoordinate | null>(null);
  const lastFixRef = useRef<DriverFix | null>(null);
  const [heading, setHeading] = useState(0);
  const [permissionState, setPermissionState] = useState<PermissionState>("checking");
  const [ownFix, setOwnFix] = useState<DriverFix | null>(null);
  const [route, setRoute] = useState<GoogleRouteResult | null>(null);
  const [routeSource, setRouteSource] = useState<"google" | "fallback" | null>(null);
  const [isRouteLoading, setRouteLoading] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");

  const fix: DriverFix | null = trackerSharing && tracker.lastFix ? tracker.lastFix : ownFix;
  const driverCoordinate = useMemo(
    () => (fix ? { latitude: fix.latitude, longitude: fix.longitude } : null),
    [fix?.latitude, fix?.longitude], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Own GPS stream when the trip tracker isn't already running one.
  useEffect(() => {
    if (trackerSharing) {
      setPermissionState("granted");
      return;
    }
    if (!("geolocation" in navigator)) {
      setPermissionState("denied");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionState("granted");
        setOwnFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading != null && position.coords.heading >= 0 ? position.coords.heading : null,
          speed: position.coords.speed != null && position.coords.speed >= 0 ? position.coords.speed : null,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState("denied");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackerSharing]);

  // Heading: the device's when moving, direction of travel otherwise.
  useEffect(() => {
    if (!fix) return;
    const prev = lastFixRef.current;
    if (fix.heading != null && (fix.speed == null || fix.speed > 1)) {
      setHeading(fix.heading);
    } else if (prev && getDistanceMeters(prev, fix) > 6) {
      setHeading(bearing(prev, fix));
    }
    lastFixRef.current = fix;
  }, [fix?.latitude, fix?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isWaiting) {
      setWaitingSeconds(0);
      return;
    }
    const id = setInterval(() => setWaitingSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isWaiting]);

  // Route: Google traffic-aware when configured, refreshed after the car moves 75 m.
  useEffect(() => {
    const origin = driverCoordinate ?? destinationCoordinate;
    if (!origin || !isValidCoordinate(destinationCoordinate)) {
      setRoute(null);
      setRouteSource(null);
      return;
    }
    const fallbackRoute = getFallbackRoute({ destination: destinationCoordinate, origin });
    if (!isGoogleRoutesConfigured()) {
      setRoute(fallbackRoute);
      setRouteSource(fallbackRoute ? "fallback" : null);
      return;
    }
    const lastOrigin = lastRouteOriginRef.current;
    if (lastOrigin && getDistanceMeters(lastOrigin, origin) < MIN_ROUTE_REFRESH_DISTANCE_METERS) {
      return;
    }
    let cancelled = false;
    setRouteLoading(true);
    fetchGoogleDrivingRoute({ destination: destinationCoordinate, origin })
      .then((next) => {
        if (cancelled) return;
        setRoute(next ?? fallbackRoute);
        setRouteSource(next ? "google" : fallbackRoute ? "fallback" : null);
        lastRouteOriginRef.current = origin;
      })
      .catch(() => {
        if (!cancelled) {
          setRoute(fallbackRoute);
          setRouteSource(fallbackRoute ? "fallback" : null);
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destinationCoordinate, driverCoordinate]);

  const ahead = useMemo(() => remainingRoute(route?.polylineCoordinates ?? [], driverCoordinate), [route, driverCoordinate]);
  const overviewCoordinates = useMemo(
    () => [driverCoordinate, destinationCoordinate, ...(route?.polylineCoordinates ?? [])].filter(isValidCoordinate),
    [destinationCoordinate, driverCoordinate, route],
  );
  const initialCenter = useMemo(
    () => driverCoordinate ?? (isValidCoordinate(destinationCoordinate) ? destinationCoordinate : DEFAULT_CENTER),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const distanceToDestination =
    driverCoordinate && isValidCoordinate(destinationCoordinate)
      ? getDistanceMeters(driverCoordinate, destinationCoordinate)
      : null;
  const nearPickup =
    mode === "pickup" && !isWaiting && distanceToDestination !== null && distanceToDestination <= ARRIVAL_NUDGE_METERS;

  const durationLabel = formatRouteDuration(route?.durationSeconds) ?? "--";
  const distanceLabel = formatRouteDistance(route?.distanceMeters) ?? "--";
  const arrivalLabel = formatArrivalTime(route?.durationSeconds) ?? "--";
  const routeHint =
    routeSource === "fallback" ? "Estimated route" : routeSource === "google" ? "Live traffic route" : "Preparing route";
  const primaryActionLabel =
    mode === "pickup" ? (isWaiting ? "Start Ride" : nearPickup ? "I've arrived" : "Arrived") : "End Ride";
  const chipTitle =
    mode === "pickup"
      ? route?.durationSeconds
        ? `Pickup · ${formatRouteDuration(route.durationSeconds)}`
        : "Pickup"
      : route?.durationSeconds
        ? `Drop-off · ${formatRouteDuration(route.durationSeconds)}`
        : "Drop-off";

  const sharing = (() => {
    if (tracker.problem === "permission") {
      return { tone: "#D92D20", label: "Location access is off. Your passenger can't see you." };
    }
    if (tracker.problem === "unsupported") {
      return { tone: "#D92D20", label: "This browser can't share your location." };
    }
    if (tracker.problem === "offline") {
      return {
        tone: "#F79009",
        label: tracker.pendingFixes ? `Offline · ${tracker.pendingFixes} updates waiting to send` : "Offline · will resume automatically",
      };
    }
    if (tracker.status === "sharing") {
      return { tone: "#12B76A", label: "Live with your passenger · keep this screen open" };
    }
    if (tracker.status === "starting") {
      return { tone: "#98A2B3", label: "Starting live location…" };
    }
    return null;
  })();

  const handlePrimaryAction = () => {
    if (primaryActionLoading) return;
    if (mode === "dropoff") {
      onEndRide?.();
      return;
    }
    if (isWaiting) {
      onStartRide?.();
      return;
    }
    setIsWaiting(true);
    onArrived?.();
  };

  const directionsUrl = getMapsDirectionsUrl({
    destinationAddress,
    destinationLat: destinationCoordinate?.latitude,
    destinationLng: destinationCoordinate?.longitude,
    originLat: driverCoordinate?.latitude,
    originLng: driverCoordinate?.longitude,
  });

  const destinationIcon = useMemo(
    () =>
      createDestinationIcon({
        mode,
        title: isWaiting && mode === "pickup" ? "You're here" : chipTitle,
        subtitle: shortPlace(destinationAddress),
        night: isDark,
      }),
    [chipTitle, destinationAddress, isDark, isWaiting, mode],
  );
  const carIcon = useMemo(() => createDriverCarIcon({ heading, night: isDark }), [isDark]); // eslint-disable-line react-hooks/exhaustive-deps
  const carMarkerRef = useRef<L.Marker | null>(null);

  // Rotate the existing DOM node rather than rebuilding the icon on every fix.
  useEffect(() => {
    const body = carMarkerRef.current?.getElement()?.querySelector<HTMLElement>(".car-marker__body");

    if (body) {
      body.style.transform = `rotate(${Math.round(heading)}deg)`;
    }
  }, [heading, carIcon]);
  const routeColor = isDark ? "#4F9BFF" : "#0673FF";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <MapContainer
        center={toLatLng(initialCenter)}
        zoom={driverCoordinate ? 16 : 13}
        zoomControl={false}
        attributionControl
        className={`absolute inset-0 z-0 h-full w-full ${isDark ? "map-night" : ""}`}
      >
        <TileLayer url={TILES_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <MapCamera
          cameraMode={cameraMode}
          driverCoordinate={driverCoordinate}
          overview={overviewCoordinates}
          onUserPan={() => setCameraMode("free")}
        />
        {ahead.length > 1 && (
          <>
            <Polyline positions={ahead.map(toLatLng)} pathOptions={{ color: routeColor, weight: 14, opacity: 0.18, lineCap: "round" }} />
            <Polyline positions={ahead.map(toLatLng)} pathOptions={{ color: "#fff", weight: 9, opacity: 0.9, lineCap: "round" }} />
            <Polyline
              positions={ahead.map(toLatLng)}
              pathOptions={{
                color: routeColor,
                weight: 6,
                lineCap: "round",
                dashArray: routeSource === "fallback" ? "12 10" : undefined,
              }}
            />
          </>
        )}
        {isValidCoordinate(destinationCoordinate) && (
          <Marker position={toLatLng(destinationCoordinate)} icon={destinationIcon} zIndexOffset={200} />
        )}
        {driverCoordinate && <Marker ref={carMarkerRef} position={toLatLng(driverCoordinate)} icon={carIcon} zIndexOffset={300} />}
      </MapContainer>

      {/* Top chrome */}
      <div className="pointer-events-none absolute inset-x-4 z-10" style={{ top: "calc(var(--safe-top) + 8px)" }}>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="glass pressable pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full text-text shadow-float"
            aria-label="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => setCameraMode(cameraMode === "follow" ? "overview" : "follow")}
            className="glass pressable pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full text-text shadow-float"
            aria-label={cameraMode === "follow" ? "Show the whole route" : "Follow my car"}
          >
            {cameraMode === "follow" ? <Maximize2 size={19} /> : <Navigation size={19} />}
          </button>
        </div>

        <div className="pointer-events-auto flex items-center rounded-2xl bg-[rgba(17,24,39,0.96)] px-5 py-4 shadow-float">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            {mode === "pickup" ? <Navigation size={22} /> : <Flag size={22} />}
          </span>
          <div className="ml-4 min-w-0 flex-1">
            <p className="text-caption text-[#9FB0C8]">{mode === "pickup" ? "Head to pickup" : "Head to drop-off"}</p>
            <p className="text-headline mt-0.5 truncate text-white">{shortPlace(destinationAddress)}</p>
          </div>
          <div className="ml-3 text-right">
            <p className="text-[18px] font-bold text-white">
              {formatRouteDistance(distanceToDestination ?? route?.distanceMeters) ?? "--"}
            </p>
            <p className="text-[11px] text-[#9FB0C8]">{durationLabel}</p>
          </div>
        </div>

        {sharing && (
          <div className="glass pointer-events-auto mt-3 inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 shadow-float">
            {sharing.tone === "#12B76A" ? (
              <PulseDot color={sharing.tone} />
            ) : (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sharing.tone }} />
            )}
            <span className="text-caption truncate font-medium text-text">{sharing.label}</span>
          </div>
        )}
      </div>

      {cameraMode === "free" && driverCoordinate && (
        <button
          type="button"
          onClick={() => setCameraMode("follow")}
          className="glass pressable anim-rise-in absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 shadow-float"
          style={{ bottom: "calc(var(--safe-bottom) + 262px)" }}
        >
          <Navigation size={15} className="text-accent" />
          <span className="text-footnote font-semibold text-text">Re-center</span>
        </button>
      )}

      {isRouteLoading && (
        <div
          className="glass absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 shadow-float"
          style={{ top: "calc(var(--safe-top) + 190px)" }}
        >
          <Spinner size={14} className="text-accent" />
          <span className="text-caption text-text-2">Updating route</span>
        </div>
      )}

      {/* Bottom sheet */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 rounded-t-[28px] bg-bg-elevated px-6 pt-3 shadow-sheet"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 20px)" }}
      >
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-border-strong" />

        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-caption text-text-3">
              {mode === "pickup" ? (isWaiting ? "Waiting for your passenger" : "Arriving in") : "To drop-off"}
            </p>
            <div className="mt-0.5 flex items-end">
              <p className="text-[30px] leading-none font-bold tabular-nums text-text">
                {isWaiting && mode === "pickup" ? formatWaitingTime(waitingSeconds) : durationLabel}
              </p>
              {!(isWaiting && mode === "pickup") && (
                <p className="text-footnote mb-0.5 ml-2 font-medium text-text-3">
                  {distanceLabel} · {arrivalLabel}
                </p>
              )}
            </div>
          </div>
          <span className="mt-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-medium text-white uppercase">
            {statusLabel}
          </span>
        </div>

        <div className="text-caption mt-1 flex flex-wrap items-center gap-x-2 text-text-4">
          <span>{routeHint}</span>
          {permissionState === "denied" && <span className="text-danger">Location permission needed</span>}
          {!isValidCoordinate(destinationCoordinate) && <span className="text-danger">Destination coordinates missing</span>}
          {directionsUrl && (
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent">
              Open in Google Maps
            </a>
          )}
        </div>

        {nearPickup && (
          <div className="anim-rise-in mt-4 flex items-center gap-2 rounded-2xl border border-success/30 bg-success-soft px-4 py-3">
            <MapPin size={16} className="shrink-0 text-success" />
            <p className="text-footnote font-medium text-success-text">
              You&apos;re at the pickup point. Let your passenger know you&apos;ve arrived.
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={onCall}
            className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-navy-mid dark:text-accent"
            aria-label="Call passenger"
          >
            <Phone size={18} />
          </button>
          <button
            type="button"
            onClick={onWhatsapp}
            className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[#25D366]"
            aria-label="WhatsApp passenger"
          >
            <WhatsAppIcon size={22} />
          </button>
          <button
            type="button"
            disabled={primaryActionLoading}
            onClick={handlePrimaryAction}
            className={`pressable flex h-12 flex-1 items-center justify-center rounded-xl text-[15px] font-semibold text-white ${
              nearPickup ? "bg-success" : "bg-[#E32636]"
            } ${primaryActionLoading ? "opacity-60" : ""}`}
          >
            {primaryActionLoading ? "Updating..." : primaryActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
