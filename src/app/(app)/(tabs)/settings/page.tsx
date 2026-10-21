"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  List,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  Moon,
  PlusCircle,
  Shield,
  Smartphone,
  Sun,
} from "lucide-react";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { AlertDialog } from "@/components/ui/Dialog";
import { ListGroup, ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Toggle } from "@/components/ui/Toggle";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useDriverNotificationSettings,
  useToggleDriverNotificationSettings,
} from "@/lib/api/hooks/useDriverSettings";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";

const SUPPORT_EMAIL = "info@autogirl.ng";

const THEME_OPTIONS: Array<{ icon: typeof Sun; label: string; value: ThemePreference }> = [
  { icon: Smartphone, label: "System", value: "system" },
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
];

type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

const queryGeolocationPermission = async (): Promise<PermissionStatus> => {
  if (!("geolocation" in navigator)) {
    return "unsupported";
  }
  if (!("permissions" in navigator)) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state as PermissionStatus;
  } catch {
    return "unknown";
  }
};

const getNotificationPermission = (): PermissionStatus => {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission === "default" ? "prompt" : (Notification.permission as PermissionStatus);
};

const ThemeSelector = () => {
  const { themePreference, setThemePreference } = useTheme();
  const activeIndex = THEME_OPTIONS.findIndex((option) => option.value === themePreference);

  return (
    <div className="px-4 py-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-alt text-text-2">
          <Monitor size={18} />
        </span>
        <div>
          <p className="text-body font-medium text-text">Appearance</p>
          <p className="text-footnote text-text-3">
            {THEME_OPTIONS.find((option) => option.value === themePreference)?.label ?? "System"}
          </p>
        </div>
      </div>

      {/* Segmented control with a sliding thumb */}
      <div className="relative grid grid-cols-3 rounded-xl bg-fill p-1" role="radiogroup" aria-label="Appearance">
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 w-[calc((100%-8px)/3)] rounded-[9px] bg-bg-elevated shadow-float"
          style={{
            transform: `translateX(calc(${activeIndex} * 100%))`,
            left: 4,
            transition: "transform var(--dur) var(--ease-spring)",
          }}
        />
        {THEME_OPTIONS.map(({ icon: Icon, label, value }) => {
          const isSelected = value === themePreference;

          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setThemePreference(value)}
              className={`relative z-10 flex h-9 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors ${
                isSelected ? "text-text" : "text-text-3"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const notificationSettingsQuery = useDriverNotificationSettings();
  const toggleDriverNotificationSettings = useToggleDriverNotificationSettings();
  const [locationPermission, setLocationPermission] = useState<PermissionStatus>("unknown");
  const [isLocationLoading, setLocationLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState<PermissionStatus>("unknown");
  const [isIncidentReportsExpanded, setIncidentReportsExpanded] = useState(false);
  const [isSignOutModalVisible, setSignOutModalVisible] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);

  const backendPushNotifications = notificationSettingsQuery.data?.data.sendNotification;
  const pushNotifications = backendPushNotifications ?? false;
  const isPushToggleDisabled =
    notificationSettingsQuery.isLoading ||
    toggleDriverNotificationSettings.isPending ||
    !notificationSettingsQuery.data;
  const notificationErrorMessage = getApiErrorMessage(notificationSettingsQuery.error);
  const pushDescription = notificationSettingsQuery.isError
    ? (notificationErrorMessage ?? "Unable to load notification preference")
    : pushNotifications && pushPermission === "denied"
      ? "Allow notifications for this site in your browser settings"
      : pushNotifications
        ? "Trip alerts are enabled"
        : "Trip alerts are off";
  const locationEnabled = locationPermission === "granted";

  useEffect(() => {
    void queryGeolocationPermission().then(setLocationPermission);
    setPushPermission(getNotificationPermission());

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void queryGeolocationPermission().then(setLocationPermission);
        setPushPermission(getNotificationPermission());
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const handleLocationChange = async (nextValue: boolean) => {
    if (!nextValue) {
      toast.info("Manage location in Settings", "Location permission can only be turned off from your browser settings.");
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationPermission("granted");
        setLocationLoading(false);
        toast.success("Location enabled");
      },
      (error) => {
        setLocationLoading(false);
        setLocationPermission(error.code === error.PERMISSION_DENIED ? "denied" : "prompt");
        toast.error(
          "Location permission required",
          error.code === error.PERMISSION_DENIED
            ? "Turn on location access for this site in your browser settings."
            : "Please allow location access to use navigation.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  const handlePushNotificationsChange = async (nextValue: boolean) => {
    if (isPushToggleDisabled) {
      return;
    }

    try {
      if (nextValue && typeof Notification !== "undefined" && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        setPushPermission(permission === "default" ? "prompt" : (permission as PermissionStatus));
      }

      if (!nextValue && backendPushNotifications === false) {
        return;
      }

      const response = await toggleDriverNotificationSettings.mutateAsync();
      toast.success(response.data.sendNotification ? "Push notifications enabled" : "Push notifications disabled");
    } catch (error) {
      toast.error("Unable to update notifications", getApiErrorMessage(error) ?? "Please try again.");
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);

    try {
      queryClient.clear();
      await signOut({ redirect: false });
      toast.success("Signed out successfully");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Sign out failed", "Please try again.");
    } finally {
      setSigningOut(false);
      setSignOutModalVisible(false);
    }
  };

  const reportProblem = () => {
    const subject = encodeURIComponent("Muvment Driver App Problem Report");
    const body = encodeURIComponent("Please describe the problem you experienced:\n\n");

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <Screen withTabBar>
      <DashboardHeader title="Settings" />

      <div className="space-y-6 px-5 pt-1">
        <ListGroup header="Preferences">
          <ThemeSelector />
          <ListRow
            icon={<Bell size={18} />}
            title="Push Notifications"
            description={pushDescription}
            chevron={false}
            trailing={
              <Toggle
                checked={pushNotifications}
                disabled={isPushToggleDisabled}
                onChange={(value) => void handlePushNotificationsChange(value)}
                label="Push notifications"
              />
            }
          />
          <ListRow
            icon={<MapPin size={18} />}
            title="Location Services"
            description={locationEnabled ? "Location access is enabled" : "Required for navigation"}
            chevron={false}
            trailing={
              <Toggle
                checked={locationEnabled}
                disabled={isLocationLoading || locationPermission === "unsupported"}
                onChange={(value) => void handleLocationChange(value)}
                label="Location services"
              />
            }
          />
        </ListGroup>

        <ListGroup header="Account">
          <ListRow
            icon={<Lock size={18} />}
            title="Change Password"
            description="Update your account password"
            onClick={() => router.push("/change-password")}
          />
          <ListRow
            icon={<Shield size={18} />}
            title="Privacy Policy"
            description="Review how your information is handled"
            onClick={() => router.push("/privacy-policy")}
          />
          <ListRow
            icon={<FileText size={18} />}
            title="Employee Terms of Use"
            description="Read driver app terms and conditions"
            onClick={() => router.push("/terms-of-use")}
          />
        </ListGroup>

        <ListGroup header="Reports">
          <ListRow
            icon={<ClipboardList size={18} />}
            title="Checklist History"
            description="Resume an incomplete checklist or review a past one"
            onClick={() => router.push("/checklist-history")}
          />
          <ListRow
            icon={<AlertTriangle size={18} />}
            iconTone="warning"
            title="Incident Reports"
            description="Report incidents and review previous reports"
            chevron={false}
            trailing={
              isIncidentReportsExpanded ? (
                <ChevronUp size={18} className="text-text-4" />
              ) : (
                <ChevronDown size={18} className="text-text-4" />
              )
            }
            onClick={() => setIncidentReportsExpanded((value) => !value)}
          />
          {isIncidentReportsExpanded && (
            <>
              <ListRow
                inset
                icon={<PlusCircle size={16} />}
                title="Report Incident"
                description="Submit a trip incident with photo evidence"
                onClick={() => router.push("/incident-report")}
              />
              <ListRow
                inset
                icon={<List size={16} />}
                title="Incident Reports"
                description="View submitted incident reports"
                onClick={() => router.push("/incident-reports")}
              />
            </>
          )}
          <ListRow
            icon={<AlertCircle size={18} />}
            title="Report a Problem"
            description="Contact support about an app issue"
            onClick={reportProblem}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={<LogOut size={18} />}
            iconTone="danger"
            title="Sign Out"
            titleTone="danger"
            onClick={() => setSignOutModalVisible(true)}
          />
        </ListGroup>
      </div>

      <AlertDialog
        open={isSignOutModalVisible}
        onClose={() => setSignOutModalVisible(false)}
        onConfirm={() => void confirmSignOut()}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        confirmVariant="danger"
        confirmLoading={isSigningOut}
      />
    </Screen>
  );
}
