export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export const isValidCoordinate = (
  coordinate?: MapCoordinate | null,
): coordinate is MapCoordinate => {
  if (!coordinate) {
    return false;
  }

  return (
    Number.isFinite(coordinate.latitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
};

export const toMapCoordinate = ({
  lat,
  lng,
}: {
  lat?: number | null;
  lng?: number | null;
}): MapCoordinate | null => {
  const coordinate = {
    latitude: lat ?? Number.NaN,
    longitude: lng ?? Number.NaN,
  };

  return isValidCoordinate(coordinate) ? coordinate : null;
};

export const decodeGooglePolyline = (encodedPolyline: string): MapCoordinate[] => {
  const coordinates: MapCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encodedPolyline.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encodedPolyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encodedPolyline.length);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    const coordinate = {
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    };

    if (isValidCoordinate(coordinate)) {
      coordinates.push(coordinate);
    }
  }

  return coordinates;
};

export const getDistanceMeters = (
  origin: MapCoordinate,
  destination: MapCoordinate,
) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusMeters * centralAngle;
};

export const getLinearRouteCoordinates = (
  origin: MapCoordinate,
  destination: MapCoordinate,
  steps = 20,
) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;

    return {
      latitude:
        origin.latitude + (destination.latitude - origin.latitude) * ratio,
      longitude:
        origin.longitude + (destination.longitude - origin.longitude) * ratio,
    };
  });
