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
}

export type UserProfileResponse = ApiResponse<UserProfile>;

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
}

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
}

export type ChecklistStepResponse =
  ApiResponse<ChecklistStepResponseData>;

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
  vehicleInfo?: {
    vehicleIdentifier: string;
    vehicleName: string;
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

export type VehicleFeatureCategory = "FLASHY" | "PRIMARY" | "AUXILIARY";

export interface VehicleFeature {
  id: string;
  name: string;
  description?: string | null;
  category: VehicleFeatureCategory;
}

export type VehicleFeaturesResponse = ApiResponse<VehicleFeature[]>;
