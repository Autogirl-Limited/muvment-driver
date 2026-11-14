import { NextResponse, type NextRequest } from "next/server";

import { handleDriverPaymentsMock, registerMockRide, setMockRideStatus, withRide } from "./driverPaymentsMock";

/**
 * Dev-only mock of the Muvment backend so the UI can be exercised without
 * real credentials. Enable it by pointing NEXT_PUBLIC_API_URL at
 * http://localhost:3000/api/mock (see .env.example). Any email/password
 * signs in. It is disabled in production builds.
 */
const IS_ENABLED = process.env.NODE_ENV !== "production";

const now = () => new Date().toISOString();
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const ok = <T>(data: T, message = "Request successful") =>
  NextResponse.json({ status: "SUCCESSFUL", message, data, timestamp: now() });

const fakeJwt = (minutes: number) => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: "mock-driver", exp: Math.floor(Date.now() / 1000) + minutes * 60 })).toString("base64url");
  return `${header}.${payload}.mock`;
};

const TRIPS = [
  {
    id: "trip-1",
    tripCustomId: "TRP-2026-102846",
    customerName: "Chief Emeka Obiora",
    customerPhoneNumber: "+234 803 456 7890",
    pickupLocation: "Autogirl Service Center, Lekki",
    city: "Lagos",
    vehicleName: "Honda Accord",
    vehicleIdentifier: "LAG-567-ABJ",
    startDateTime: hoursFromNow(1),
    endDateTime: hoursFromNow(13),
    tripDuration: 12,
    bookingTypeName: "Standard",
    driverOwnerType: "COMPANY",
    driverTripStatus: "NOT_STARTED",
    standardTripStatus: "UPCOMING",
  },
  {
    id: "trip-2",
    tripCustomId: "TRP-2026-102847",
    customerName: "Dr. Amina Bello",
    customerPhoneNumber: "+234 802 111 2233",
    pickupLocation: "GTBank Headquarters, Victoria Island",
    city: "Lagos",
    vehicleName: "Toyota Camry",
    vehicleIdentifier: "LAG-221-KJA",
    startDateTime: hoursFromNow(-2),
    endDateTime: hoursFromNow(22),
    tripDuration: 24,
    bookingTypeName: "Full Day Rental",
    driverOwnerType: "CUSTOMER",
    driverTripStatus: "ONGOING",
    standardTripStatus: "ONGOING",
  },
  {
    id: "trip-3",
    tripCustomId: "TRP-2026-102848",
    customerName: "Mr Clark Hakeam",
    customerPhoneNumber: "+234 809 555 0101",
    pickupLocation: "Murtala Muhammed Airport, Terminal 2",
    city: "Lagos",
    vehicleName: "Honda Accord",
    vehicleIdentifier: "LAG-567-ABJ",
    startDateTime: hoursFromNow(-30),
    endDateTime: hoursFromNow(-26),
    tripDuration: 4,
    bookingTypeName: "Airport",
    driverOwnerType: "HOST",
    driverTripStatus: "COMPLETE",
    standardTripStatus: "COMPLETED",
  },
  {
    id: "trip-4",
    tripCustomId: "TRP-2026-102849",
    customerName: "Mrs Ngozi Eze",
    customerPhoneNumber: "+234 805 222 3344",
    pickupLocation: "Eko Hotel, Victoria Island",
    city: "Lagos",
    vehicleName: "Lexus RX 350",
    vehicleIdentifier: "LAG-909-EKY",
    // Starts two minutes after the dev server boots, to show the auto-start countdown.
    startDateTime: hoursFromNow(2 / 60),
    endDateTime: hoursFromNow(12 + 2 / 60),
    tripDuration: 12,
    bookingTypeName: "12 Hours",
    driverOwnerType: "COMPANY",
    driverTripStatus: "AWAITING_PICKUP",
    standardTripStatus: "UPCOMING",
  },
  {
    id: "trip-5",
    tripCustomId: "TRP-2026-102850",
    customerName: "Engr. Musa Danjuma",
    customerPhoneNumber: "+234 806 777 8899",
    pickupLocation: "Ikoyi Club, Ikoyi",
    city: "Lagos",
    vehicleName: "Toyota Prado",
    vehicleIdentifier: "LAG-404-IKY",
    startDateTime: hoursFromNow(-12.5),
    endDateTime: hoursFromNow(-0.4),
    tripDuration: 12,
    bookingTypeName: "12 Hours",
    driverOwnerType: "COMPANY",
    driverTripStatus: "EXTRA_TIME",
    standardTripStatus: "ONGOING",
  },
];

const INVOICES: Record<string, string> = {
  "trip-1": "INVAG-1110",
  "trip-2": "INVAG-1104",
  "trip-3": "INVAG-1093",
  "trip-4": "INVAG-1112",
  "trip-5": "INVAG-1099",
};

// Ride timer state for each mock trip (see driverPaymentsMock.ts).
TRIPS.forEach((trip) => {
  const bookedStartMs = Date.parse(trip.startDateTime);
  const bookedEndMs = Date.parse(trip.endDateTime);
  const started = ["ONGOING", "EXTRA_TIME", "COMPLETE"].includes(trip.driverTripStatus);
  registerMockRide(trip.id, {
    status: trip.driverTripStatus,
    bookedStartMs,
    bookedEndMs,
    actualStartMs: started ? bookedStartMs - 5 * 60_000 : null,
    startMethod: started ? "DRIVER" : null,
    actualEndMs: trip.driverTripStatus === "COMPLETE" ? bookedEndMs + 40 * 60_000 : null,
    endMethod: trip.driverTripStatus === "COMPLETE" ? "DRIVER" : null,
    closeoutStatus: trip.driverTripStatus === "COMPLETE" ? "CLOSED" : "OPEN",
  });
});

const listTrip = (trip: (typeof TRIPS)[number]) =>
  withRide({ ...trip, bookingId: `bk-${INVOICES[trip.id]?.slice(-4)}`, invoiceNumber: INVOICES[trip.id] ?? null });

const STATISTICS = { assignedTrips: 3, cancelledTrips: 0, completedTrips: 1, onGoingTrips: 1, upcomingTrips: 1 };

const NOTIFICATIONS = [
  {
    id: "n-1",
    title: "Trip Update Confirmed",
    message: "Your latest trip status update has been confirmed by operations.",
    createdAt: now(),
    isRead: false,
    type: "SUCCESS",
    priority: "LOW",
    isDeleted: false,
    entityId: "TRP-2026-102847",
    entityName: "Trip",
    actionUrl: "/trip/trip-2",
  },
  {
    id: "n-2",
    title: "Upcoming Pickup Reminder",
    message: "Your trip with Chief Emeka Obiora starts in 60 minutes.",
    createdAt: hoursFromNow(-3),
    isRead: true,
    type: "INFO",
    priority: "MEDIUM",
    isDeleted: false,
  },
  {
    id: "n-3",
    title: "Pilot Report Review Needed",
    message: "A submitted pilot report needs your attention. Contact support.",
    createdAt: hoursFromNow(-50),
    isRead: true,
    type: "WARNING",
    priority: "HIGH",
    isDeleted: false,
  },
];

const summarySection = (valid: boolean, captured = valid ? 4 : 0) => ({ photosCaptured: captured, photosNotCaptured: valid ? 0 : 4, valid });

const PRE_SUMMARY = {
  driverPhoto: summarySection(false, 0),
  exteriorPhotos: summarySection(true),
  interiorPhotos: { ...summarySection(false, 0), metadata: undefined },
  totalCompletionTime: "4 min 12 sec",
  vehicleHealthCheckPhotos: summarySection(false, 0),
  vehicleInfo: { vehicleIdentifier: "LAG-567-ABJ", vehicleName: "Honda Accord" },
};

const tripDetails = (id: string) => {
  const trip = listTrip(TRIPS.find((item) => item.id === id) ?? TRIPS[0]);

  return {
    ...trip,
    pickupLocation: { lat: 6.4474, lng: 3.4723, location: trip.pickupLocation },
    dropOffLocation: { lat: 6.5965, lng: 3.3421, location: "65b Opebi Road, Ikeja" },
  };
};

const handle = async (request: NextRequest, path: string) => {
  const method = request.method;

  if (path === "auth/login" && method === "POST") {
    return ok({
      accessToken: fakeJwt(30),
      refreshToken: "mock-refresh-token",
      userId: "mock-driver",
      firstName: "Adaeze",
      lastName: "Okafor",
      email: "driver@example.com",
      canSeeApi: false,
      roles: ["DRIVER"],
      organizations: [],
      accessibleRoutes: [],
      emailVerified: true,
      phoneVerified: true,
    });
  }
  if (path === "auth/refresh-token" && method === "POST") {
    return ok({ accessToken: fakeJwt(30) });
  }
  if (path.startsWith("auth/") || path === "driver-applications") {
    return ok(null, "Done");
  }
  if (path === "users/me") {
    return ok({
      userId: "mock-driver",
      firstName: "Adaeze",
      lastName: "Okafor",
      email: "driver@example.com",
      phoneNumber: "+234 801 234 5678",
      vehicleId: "veh-1",
      userType: "Professional Driver",
      driverIdentifier: "MUV-DRV-0042",
      canSeeApi: false,
      emailVerified: true,
      phoneVerified: false,
    });
  }
  if (path === "users/change-password") {
    return ok(null, "Password changed successfully");
  }
  if (path === "driver-app/trips/statistics") {
    return ok(STATISTICS);
  }
  if (path === "driver-app/trips/report") {
    return ok({ content: [], currentPage: 0, pageSize: 10, totalItems: 0, totalPages: 0 });
  }
  if (path === "driver-app/trips") {
    const search = request.nextUrl.searchParams.get("search")?.toLowerCase();
    const status = request.nextUrl.searchParams.get("tripStatus");
    const content = TRIPS.map(listTrip).filter(
      (trip) =>
        (!search || `${trip.tripCustomId} ${trip.customerName}`.toLowerCase().includes(search)) &&
        (!status || trip.standardTripStatus === status),
    );
    return ok({ content, currentPage: 0, pageSize: 50, totalItems: content.length, totalPages: 1, statistics: STATISTICS });
  }
  const tripMatch = path.match(/^driver-app\/trips\/([^/]+)$/);
  if (tripMatch) {
    return ok(tripDetails(decodeURIComponent(tripMatch[1])));
  }
  if (/^driver-app\/trips\/[^/]+\/locations$/.test(path)) {
    return ok({ accepted: 1, trackingActive: true, phase: "EN_ROUTE_TO_PICKUP", nextUploadIntervalSeconds: 5 });
  }
  if (path === "driver-app/checklists/today") {
    return ok({ checklistTrackerId: "tracker-1", state: "PRE_TRIP_IN_PROGRESS", preTripSummary: PRE_SUMMARY });
  }
  const checklistInvoiceMatch = path.match(/^driver-app\/checklists\/invoice\/([^/]+)\/vehicles$/);
  if (checklistInvoiceMatch) {
    const invoiceNumber = decodeURIComponent(checklistInvoiceMatch[1]).toUpperCase();
    const tripId = Object.entries(INVOICES).find(([, invoice]) => invoice === invoiceNumber)?.[0];
    const invoiceTrip = TRIPS.find((trip) => trip.id === tripId);

    if (!invoiceTrip) {
      return NextResponse.json(
        { status: "NOT_FOUND", message: "No booking was found for this invoice number.", timestamp: now() },
        { status: 404 },
      );
    }

    return ok({
      assignedVehicle: {
        vehicleId: "vehicle-primary",
        vehicleName: "Honda Accord",
        vehicleIdentifier: "LAG-567-ABJ",
      },
      invoiceVehicle: {
        vehicleId: `vehicle-${invoiceTrip.id}`,
        vehicleName: invoiceTrip.vehicleName,
        vehicleIdentifier: invoiceTrip.vehicleIdentifier,
      },
    });
  }
  if (path === "driver-app/checklists/tracker") {
    return ok({
      content: [{ id: "tracker-1", status: "PRE_RIDE_OPEN", preRideCompletedAt: null }],
      currentPage: 0,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });
  }
  if (/^driver-app\/checklists\/[^/]+\/summary$/.test(path)) {
    return ok(PRE_SUMMARY);
  }
  if (/^driver-app\/checklists\/[^/]+\/aggregate$/.test(path)) {
    return ok({
      preTripSummary: PRE_SUMMARY,
      postTripSummary: { exteriorPhotos: summarySection(false, 0), interiorPhotos: summarySection(false, 0), totalCompletionTime: "" },
    });
  }
  if (/^driver-app\/checklists\/[^/]+\/transition$/.test(path)) {
    const driverTripStatus = request.nextUrl.searchParams.get("driverTripStatus");
    if (driverTripStatus) setMockRideStatus(path.split("/")[2], driverTripStatus);
    return ok({ driverId: "mock-driver", driverTripStatus, prevTripStatus: "NOT_STARTED", tripId: path.split("/")[2] });
  }
  if (path === "driver-app/settings/notification") {
    return ok({ sendNotification: true, driverId: "mock-driver", userId: "mock-driver" });
  }
  if (path.startsWith("public/vehicle-features")) {
    return ok([
      { id: "f-1", name: "Phone charger", category: "AUXILIARY" },
      { id: "f-2", name: "Wi-Fi hotspot", category: "FLASHY" },
      { id: "f-3", name: "Bottled water", category: "PRIMARY" },
    ]);
  }
  if (path === "notification/notification-by-user") {
    return ok({ content: NOTIFICATIONS, page: 0, size: 10, totalElements: NOTIFICATIONS.length, totalPages: 1, last: true, first: true });
  }
  if (path.startsWith("notification/")) {
    return ok({}, "Updated");
  }
  if (path === "media/presigned-url") {
    // Uploads land in a local sink; the stored "file" is a bundled image.
    const origin = request.nextUrl.origin;
    return ok({
      expiresAt: hoursFromNow(1),
      fileUrl: `${origin}/brand/package.png`,
      key: `mock/${Date.now()}.jpg`,
      uploadUrl: `${origin}/api/mock/upload-sink`,
    });
  }
  if (path === "media/upload") {
    // The server route: same result as a presigned upload, with no uploadUrl.
    return ok({ fileUrl: `${request.nextUrl.origin}/brand/package.png`, key: `mock/${Date.now()}.jpg` }, "File uploaded");
  }

  const driverPayments = await handleDriverPaymentsMock(request, path);
  if (driverPayments) {
    return driverPayments;
  }

  return NextResponse.json({ status: "NOT_FOUND", message: `No mock for ${method} /${path}`, timestamp: now() }, { status: 404 });
};

const handler = async (request: NextRequest, context: { params: Promise<{ path: string[] }> }) => {
  if (!IS_ENABLED) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { path } = await context.params;

  return handle(request, path.join("/"));
};

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
