import { decodeGooglePolyline, type MapCoordinate } from "../utils/geo";

const GOOGLE_ROUTES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_ROUTES_API_KEY?.trim() ?? "";
const GOOGLE_ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_ROUTES_FIELD_MASK =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

export type GoogleRouteResult = {
  distanceMeters?: number;
  durationSeconds?: number;
  polylineCoordinates: MapCoordinate[];
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }>;
};

const parseDurationSeconds = (duration?: string) => {
  if (!duration?.endsWith("s")) {
    return undefined;
  }

  const seconds = Number(duration.slice(0, -1));

  return Number.isFinite(seconds) ? seconds : undefined;
};

export const isGoogleRoutesConfigured = () => Boolean(GOOGLE_ROUTES_API_KEY);

export const fetchGoogleDrivingRoute = async ({
  destination,
  origin,
}: {
  destination: MapCoordinate;
  origin: MapCoordinate;
}): Promise<GoogleRouteResult | null> => {
  if (!GOOGLE_ROUTES_API_KEY) {
    return null;
  }

  const response = await fetch(GOOGLE_ROUTES_ENDPOINT, {
    body: JSON.stringify({
      computeAlternativeRoutes: false,
      destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      routingPreference: "TRAFFIC_AWARE",
      travelMode: "DRIVE",
      units: "METRIC",
    }),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
      "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to load route from Google Maps.");
  }

  const data = (await response.json()) as GoogleRoutesResponse;
  const route = data.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline;

  if (!encodedPolyline) {
    return null;
  }

  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: parseDurationSeconds(route.duration),
    polylineCoordinates: decodeGooglePolyline(encodedPolyline),
  };
};
