import type { RideTimer } from "./driverPaymentTypes";

export type ApiStatus = "SUCCESSFUL";

export type DriverApplicationStatus = "PENDING";
export type DriverTripStatus =
  | "NOT_STARTED"
  | "CHECKED_IN"
  | "AWAITING_PICKUP"
  | "RUNNING_LATE"
  | "ONGOING"
  | "EXTRA_TIME"
  | "COMPLETE"
  | "CANCELLED";

export type StandardTripStatus =
  | "ASSIGNED"
  | "UPCOMING"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export type ChecklistTrackerStatus =
  | "PRE_RIDE_OPEN"
  | "PRE_RIDE_CLOSED"
  | "POST_RIDE_OPEN"
  | "POST_RIDE_CLOSED";

export type TodayChecklistState =
  | "NOT_STARTED"
  | "PRE_TRIP_IN_PROGRESS"
  | "PRE_TRIP_COMPLETED"
  | "POST_TRIP_IN_PROGRESS"
  | "DAY_ENDED";

export interface ApiResponse<TData> {
  status: ApiStatus;
  message: string;
  errorCode?: string;
  data: TData;
  timestamp: string;
}

export interface ApiMessageResponse {
  status: ApiStatus;
  message: string;
  errorCode?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  status?: string;
  message?: string | string[];
  timestamp?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginRoute {
  id: string;
  name: string;
  href: string;
  iconName: string;
  path: string;
}

export interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  canSeeApi: boolean;
  roles: string[];
  organizations: string[];
  accessibleRoutes: LoginRoute[];
  emailVerified: boolean;
  phoneVerified: boolean;
}

export type LoginResponse = ApiResponse<LoginResponseData>;

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface RefreshTokenResponseData {
  accessToken: string;
}

export type RefreshTokenResponse = ApiResponse<RefreshTokenResponseData>;

export interface ForgotPasswordPayload {
  email: string;
}

export type ForgotPasswordResponse = ApiMessageResponse;

export interface VerifyAccountPayload {
  email: string;
  otp: string;
}

export type VerifyAccountResponse = ApiMessageResponse;

export interface ResendVerificationOtpPayload {
  email: string;
}

export type ResendVerificationOtpResponse = ApiMessageResponse;

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

export type ResetPasswordResponse = ApiMessageResponse;

export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  vehicleId?: string | null;
  userType: string;
  driverIdentifier: string;
  canSeeApi: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Required for drivers: their daily selfie is checked against it. */
  profilePictureUrl?: string | null;
}

export type UserProfileResponse = ApiResponse<UserProfile>;

export interface ProfilePhotoResult {
  profilePictureUrl: string;
  /** What the AI thought of the photo, for the driver. */
  feedback: string;
  checked: boolean;
}

export type ProfilePhotoResponse = ApiResponse<ProfilePhotoResult>;

export interface DriverNotificationSettings {
  sendNotification: boolean;
  driverId: string;
  userId: string;
}

export type DriverNotificationSettingsResponse =
  ApiResponse<DriverNotificationSettings>;

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export type ChangePasswordResponse = ApiMessageResponse;

export interface DriverApplicationPayload {
  fullName: string;
  email: string;
  primaryPhoneNumber: string;
  alternativePhoneNumber?: string;
  yearsOfExperience: number;
}

export interface DriverApplicationResponseData {
  id: string;
  fullName: string;
  email: string;
  primaryPhoneNumber: string;
  alternativePhoneNumber: string;
  yearsOfExperience: number;
  status: DriverApplicationStatus;
  createdAt: string;
}

export type DriverApplicationResponse =
  ApiResponse<DriverApplicationResponseData>;

export interface PaginatedApiResponseData<TData> {
  content: TData[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type NotificationType = "INFO" | "WARNING" | "ERROR" | "SUCCESS";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH";

export interface UserNotification {
  createdAt: string;
  updatedAt?: string | null;
  id: string;
  title: string;
  isRead: boolean;
  message: string;
  entityId?: string | null;
  entityName?: string | null;
  actionUrl?: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  isDeleted: boolean;
}

export interface UserNotificationsPage {
  content: UserNotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
}

export type UserNotificationsResponse =
  ApiResponse<UserNotificationsPage>;

export type MarkNotificationReadResponse =
  ApiResponse<Record<string, never>>;

export interface DriverTrip {
  id: string;
  vehicleId?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  vehicleIdentifier?: string | null;
  vehicleName?: string | null;
  primaryVehicleImage?: string | null;
  driverName?: string | null;
  driverPhoneNumber?: string | null;
  tripDuration?: number | null;
  city?: string | null;
  pickupLocation?: string | null;
  customerName?: string | null;
  bookingTypeName?: string | null;
  driverOwnerType?: string | null;
  createdAt?: string | null;
  tripCustomId?: string | null;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  rideTimer?: RideTimer | null;
  driverTripStatus?: DriverTripStatus | null;
  standardTripStatus?: StandardTripStatus | null;
  tripStatus?: DriverTripStatus | null;
  status?: DriverTripStatus | null;
}

export interface DriverTripStatistics {
  assignedTrips: number;
  cancelledTrips: number;
  completedTrips: number;
  onGoingTrips: number;
  upcomingTrips: number;
}

export interface DriverTripLocation {
  lat?: number | null;
  lng?: number | null;
  location?: string | null;
}

export interface DriverTripDetails {
  id: string;
  vehicleId?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  vehicleIdentifier?: string | null;
  vehicleName?: string | null;
  primaryVehicleImage?: string | null;
  driverName?: string | null;
  driverPhoneNumber?: string | null;
  tripDuration?: number | null;
  city?: string | null;
  pickupLocation?: DriverTripLocation | null;
  dropOffLocation?: DriverTripLocation | null;
  customerName?: string | null;
  customerPhoneNumber?: string | null;
  driverTripStatus?: DriverTripStatus | null;
  standardTripStatus?: StandardTripStatus | null;
  bookingTypeName?: string | null;
  driverOwnerType?: string | null;
  tripCustomId?: string | null;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  rideTimer?: RideTimer | null;
}

export interface DriverTripsQueryParams {
  page?: number;
  size?: number;
  tripStatus?: StandardTripStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface DriverTripsPage
  extends Omit<PaginatedApiResponseData<DriverTrip>, "totalPages"> {
  totalPages?: number;
  statistics?: DriverTripStatistics;
}

export type DriverTripsResponse =
  ApiResponse<DriverTripsPage>;

export type DriverTripDetailsResponse = ApiResponse<DriverTripDetails>;

export type DriverTripStatisticsResponse =
  ApiResponse<DriverTripStatistics>;

export interface IncidentReport {
  id: string;
  tripId: string;
  imageUrl: string;
  description: string;
}

export interface CreateIncidentReportPayload {
  imageURL: string;
  description: string;
}

export type CreateIncidentReportResponse =
  ApiResponse<IncidentReport>;

export type IncidentReportsResponse =
  ApiResponse<PaginatedApiResponseData<IncidentReport>>;

export interface ChecklistTracker {
  checklistStatus?: ChecklistTrackerStatus | null;
  id: string;
  postRideCompletedAt?: string | null;
  preRideCompletedAt?: string | null;
  status?: ChecklistTrackerStatus | null;
}

export type ChecklistTrackersResponse =
  ApiResponse<PaginatedApiResponseData<ChecklistTracker>>;

export type ExteriorUploadImage =
  | "FRONT"
  | "BACK"
  | "LEFT_SIDE"
  | "RIGHT_SIDE"
  | "DAMAGE";

export type InteriorUploadImage =
  | "DASHBOARD"
  | "DRIVER_SIDE"
  | "PASSENGER"
  | "REAR_SEATS"
  | "BOOT"
  | "ACCESSORIES";

export type VehicleHealthCheckPhoto =
  | "OIL_LEVEL"
  | "COOLANT_LEVEL"
  | "SAFETY_EQUIPMENT";

export type ChecklistType = "PRE_TRIP" | "POST_TRIP";

export type MediaCategory =
  | "GENERAL"
  | "USER_AVATAR"
  | "DRIVER_DOCUMENT"
  | "VEHICLE_DOCUMENT"
  | "VEHICLE_PHOTO"
  | "RIDE_PHOTO";

export interface CreatePresignedMediaUrlPayload {
  category: MediaCategory;
  contentType: string;
  entityId?: string;
  fileName: string;
}

export interface PresignedMediaUrlData {
  expiresAt: string;
  fileUrl: string;
  key: string;
  uploadUrl: string;
}

export type CreatePresignedMediaUrlResponse =
  ApiResponse<PresignedMediaUrlData>;

export interface DeleteMediaPayload {
  fileUrl: string;
}

export type DeleteMediaResponse = ApiMessageResponse;

export interface ChecklistUploadedPhoto {
  imageURL: string;
  publicCloudID: string;
}

export interface ExteriorChecklistUploadedPhoto
  extends ChecklistUploadedPhoto {
  exteriorUploadImage: ExteriorUploadImage;
}

export interface InteriorChecklistUploadedPhoto
  extends ChecklistUploadedPhoto {
  interiorUploadImage: InteriorUploadImage;
}

export interface VehicleHealthChecklistUploadedPhoto
  extends ChecklistUploadedPhoto {
  vehicleHealthCheckPhotos: VehicleHealthCheckPhoto;
}

export type DriverPhotoChecklistUploadedPhoto = ChecklistUploadedPhoto;

export interface SubmitExteriorChecklistPayload {
  capturedAt?: string;
  checklistType: ChecklistType;
  checklistTrackerId?: string;
  completedAt?: string;
  uploadPhotos: ExteriorChecklistUploadedPhoto[];
  vehicleId?: string;
}

export interface ChecklistInvoiceVehicle {
  id: string;
  imageUrl?: string | null;
  name: string;
  identifier: string;
  /** TRIP: the API returned no assigned vehicle, so it is taken from the driver's trips. */
  source: "ASSIGNED" | "INVOICE" | "TRIP";
}

export interface ChecklistInvoiceVehicleData {
  id: string;
  images?: Array<{
    primary: boolean;
    url: string;
  }> | null;
  licensePlateNumber: string;
  vehicleIdentifier: string;
}

export interface ChecklistInvoiceVehiclesData {
  driverAssignedVehicle?: ChecklistInvoiceVehicleData | null;
  invoiceBookedVehicle?: ChecklistInvoiceVehicleData | null;
  invoiceNumber: string;
}

export type ChecklistInvoiceVehiclesResponse =
  ApiResponse<ChecklistInvoiceVehiclesData>;

export interface VehicleMetadata {
  fuelLevelInPercentage: number;
  odometerKM: number;
}

export interface SubmitInteriorChecklistPayload {
  capturedAt?: string;
  checklistType: ChecklistType;
  checklistTrackerId?: string;
  completedAt?: string;
  uploadPhotos: InteriorChecklistUploadedPhoto[];
}

export interface UpdateInteriorMetadataPayload extends VehicleMetadata {
  checklistTrackerId: string;
  checklistType: ChecklistType;
}

export interface SubmitVehicleHealthChecklistPayload {
  capturedAt?: string;
  checklistTrackerId: string;
  completedAt?: string;
  uploadPhotos: VehicleHealthChecklistUploadedPhoto[];
}

export interface SubmitDriverPhotoChecklistPayload {
  capturedAt?: string;
  checklistTrackerId: string;
  completedAt?: string;
  uploadPhotos: DriverPhotoChecklistUploadedPhoto[];
}

export interface ChecklistRideImage {
  fileUrl?: string;
  id: string;
  key?: string;
  publicCloudID?: string;
  type: string;
  url?: string;
}

export interface ChecklistStepResponseData {
  checklistTrackerId?: string;
  id?: string;
  metadata?: VehicleMetadata;
  rideImages: ChecklistRideImage[];
  step: string;
  tripId?: string;
  type: string;
  vehicleMetadata?: VehicleMetadata;
  /** The server-side AI reading of the dashboard photo (interior step only). */
  dashboardReading?: DashboardReading | null;
}

export type ChecklistStepResponse =
  ApiResponse<ChecklistStepResponseData>;

/* ------------------------------------------------------- checklist AI (server) */

/** Where a server-side AI job is. Results arrive even if the app was closed. */
export type ChecklistAiStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export type DashboardReadingFlag =
  | "ODOMETER_UNREADABLE"
  | "FUEL_UNREADABLE"
  | "ODOMETER_BELOW_PREVIOUS"
  | "ODOMETER_LARGE_JUMP"
  | "ODOMETER_UNCERTAIN"
  | "LOW_FUEL"
  | "WARNING_LIGHTS"
  | "POOR_PHOTO"
  | "MILES_CONVERTED";

/** Odometer and fuel read from a dashboard photo, checked against the car's last reading. */
export interface DashboardReading {
  id: string;
  status: ChecklistAiStatus;
  checklistType: ChecklistType;
  imageUrl: string;
  odometerKm?: number | null;
  odometerConfidence?: number | null;
  fuelPercent?: number | null;
  fuelConfidence?: number | null;
  imageQuality?: string | null;
  warningLights: string[];
  previousOdometerKm?: number | null;
  previousFuelPercent?: number | null;
  previousReadingAt?: string | null;
  distanceSinceLastKm?: number | null;
  flags: DashboardReadingFlag[];
  needsReview: boolean;
  /** Written for the driver. */
  headline?: string | null;
  feedback?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  durationMs?: number | null;
}

export type DashboardReadingResponse = ApiResponse<DashboardReading | null>;

export type ExteriorSide = "FRONT" | "BACK" | "LEFT_SIDE" | "RIGHT_SIDE";

export type PhotoCheckOutcome =
  | "NO_CHANGE"
  | "NEW_DAMAGE"
  | "NO_BASELINE"
  | "UNUSABLE_PHOTO"
  | "WRONG_SIDE";

export interface DamageFinding {
  location?: string | null;
  kind?: string | null;
  severity?: "MINOR" | "MODERATE" | "SEVERE" | string | null;
  description?: string | null;
  confidence?: number | null;
}

/** One exterior photo compared with the same side of the car in its previous report. */
export interface PhotoCheck {
  id: string;
  status: ChecklistAiStatus;
  checklistType: ChecklistType;
  side: ExteriorSide;
  imageUrl: string;
  outcome?: PhotoCheckOutcome | null;
  photoUsable?: boolean | null;
  newDamage: DamageFinding[];
  existingDamage: DamageFinding[];
  previousImageUrl?: string | null;
  previousChecklistType?: ChecklistType | null;
  previousCapturedAt?: string | null;
  headline?: string | null;
  feedback?: string | null;
  retakeAdvice?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
}

export type PhotoCheckResponse = ApiResponse<PhotoCheck | null>;

export interface StartPhotoCheckPayload {
  checklistType: ChecklistType;
  side: ExteriorSide;
  imageUrl: string;
  vehicleId?: string;
  checklistTrackerId?: string;
}

/** The car's condition for a submitted exterior report, compared with its previous report. */
export interface ConditionReport {
  id: string;
  status: ChecklistAiStatus;
  checklistType: ChecklistType;
  newDamageFound?: boolean | null;
  needsReview: boolean;
  headline?: string | null;
  feedback?: string | null;
  previousChecklistType?: ChecklistType | null;
  previousCapturedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  sides: PhotoCheck[];
}

export type ConditionReportResponse = ApiResponse<ConditionReport | null>;

/** What the driver already submitted for a report: each step's photos and the confirmed readings. */
export interface SubmittedChecklistPhotos {
  checklistTrackerId: string;
  preRideCompletedAt?: string | null;
  postRideCompletedAt?: string | null;
  steps: {
    checklistId: string;
    step: "EXTERIOR" | "INTERIOR" | "VEHICLE_HEALTH_CHECK" | "DRIVER_PHOTO" | string;
    type: ChecklistType;
    submittedAt?: string | null;
    /** `type` is the photo's slot (FRONT, DASHBOARD...); for ACCESSORIES `publicId` is the feature id. */
    images: { type: string; url: string; publicId?: string | null }[];
  }[];
  preTripReadings?: { odometerKM?: number | null; fuelLevelInPercentage?: number | null } | null;
  postTripReadings?: { odometerKM?: number | null; fuelLevelInPercentage?: number | null } | null;
}

export type SubmittedChecklistPhotosResponse = ApiResponse<SubmittedChecklistPhotos>;

export type PhotoInsightKind =
  | "DAMAGE"
  | "ACCESSORY"
  | "OIL_LEVEL"
  | "COOLANT_LEVEL"
  | "SAFETY_EQUIPMENT"
  | "DRIVER_SELFIE";

export type PhotoInsightVerdict = "OK" | "ATTENTION" | "PROBLEM" | "UNUSABLE";

export type IdentityMatch = "MATCH" | "NO_MATCH" | "UNSURE" | "NO_FACE" | "NO_REFERENCE";

/** The AI's verdict and recommendation for one checklist photo. */
export interface PhotoInsight {
  id: string;
  status: ChecklistAiStatus;
  kind: PhotoInsightKind;
  label?: string | null;
  imageUrl: string;
  verdict?: PhotoInsightVerdict | null;
  /** Selfies only: how it compares with the profile photo. */
  identityMatch?: IdentityMatch | null;
  matchConfidence?: number | null;
  headline?: string | null;
  findings: string[];
  recommendation?: string | null;
  retakeAdvice?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
}

export type PhotoInsightResponse = ApiResponse<PhotoInsight | null>;
export type PhotoInsightListResponse = ApiResponse<PhotoInsight[]>;

export interface StartPhotoInsightPayload {
  kind: PhotoInsightKind;
  label?: string;
  imageUrl: string;
  checklistType: ChecklistType;
  checklistTrackerId?: string;
}

export interface PreRideChecklistSummarySection {
  photosCaptured: number;
  photosNotCaptured?: number;
  photoNotCaptured?: number;
  valid: boolean;
}

export interface PreRideInteriorChecklistSummarySection
  extends PreRideChecklistSummarySection {
  metadata?: VehicleMetadata;
}

export interface PreRideChecklistSummary {
  driverPhoto: PreRideChecklistSummarySection;
  driverTripStatus?: DriverTripStatus;
  exteriorPhotos: PreRideChecklistSummarySection;
  interiorPhotos: PreRideInteriorChecklistSummarySection;
  totalCompletionTime: string;
  vehicleHealthCheckPhotos: PreRideChecklistSummarySection;
  /** The vehicle the report is about (from its exterior photos). */
  vehicleInfo?: {
    vehicleId?: string;
    vehicleIdentifier: string;
    vehicleName: string;
    /** The vehicle's primary photo, when it has one. */
    vehicleImageUrl?: string | null;
  };
}

export type PreRideChecklistSummaryResponse =
  ApiResponse<PreRideChecklistSummary>;

export interface PostRideChecklistSummary {
  dropOffLocation?: string;
  exteriorPhotos: PreRideChecklistSummarySection;
  interiorPhotos: PreRideInteriorChecklistSummarySection;
  totalCompletionTime: string;
  vehicleMetadata?: VehicleMetadata;
}

export interface PostRideChecklistAggregate {
  postTripSummary: PostRideChecklistSummary;
  preTripSummary: PreRideChecklistSummary;
}

export type PostRideChecklistAggregateResponse =
  ApiResponse<PostRideChecklistAggregate>;

export interface TodayChecklist {
  checklistTrackerId?: string | null;
  postRideCompletedAt?: string | null;
  postTripSummary?: PostRideChecklistSummary | null;
  preRideCompletedAt?: string | null;
  preTripSummary?: PreRideChecklistSummary | null;
  state?: TodayChecklistState | null;
  status?: TodayChecklistState | null;
  trackerStatus?: ChecklistTrackerStatus | null;
}

export type TodayChecklistResponse = ApiResponse<TodayChecklist>;

export interface SubmitChecklistResponseData {
  checklistTrackerId: string;
  checklistType: ChecklistType;
  driverId: string;
  status: ChecklistTrackerStatus;
}

export type SubmitChecklistResponse =
  ApiResponse<SubmitChecklistResponseData>;

export interface TransitionDriverTripStatusResponseData {
  driverId: string;
  driverTripStatus: DriverTripStatus;
  prevTripStatus: DriverTripStatus;
  tripId: string;
}

export type TransitionDriverTripStatusResponse =
  ApiResponse<TransitionDriverTripStatusResponseData>;

/**
 * SAFETY_EQUIPMENT (warning triangle and fire extinguisher) is
 * photographed in the health check, not listed under Accessories.
 */
export type VehicleFeatureCategory = "FLASHY" | "PRIMARY" | "AUXILIARY" | "SAFETY_EQUIPMENT";

export interface VehicleFeature {
  id: string;
  name: string;
  description?: string | null;
  category: VehicleFeatureCategory;
}

export type VehicleFeaturesResponse = ApiResponse<VehicleFeature[]>;

// Ride timer, schedule, push devices, bank account and payment request types.
export type * from "./driverPaymentTypes";
