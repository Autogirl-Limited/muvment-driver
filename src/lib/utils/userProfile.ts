import type { UserProfile } from "../api/types";

type UserNameParts = Pick<UserProfile, "firstName" | "lastName">;

export const getUserDisplayName = (user?: Partial<UserNameParts>) => {
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "Driver";
};

export const getUserInitials = (user?: Partial<UserNameParts>) => {
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((name) => name?.charAt(0).toUpperCase())
    .join("");

  return initials || "DR";
};
