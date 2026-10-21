export const formatRouteDistance = (distanceMeters?: number) => {
  if (!distanceMeters || distanceMeters <= 0) {
    return undefined;
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km`;
};

export const formatRouteDuration = (durationSeconds?: number) => {
  if (!durationSeconds || durationSeconds <= 0) {
    return undefined;
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
};

export const formatArrivalTime = (
  durationSeconds?: number,
  date = new Date(),
) => {
  if (!durationSeconds || durationSeconds <= 0) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date.getTime() + durationSeconds * 1000));
};
