import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    /** Set when the refresh token was rejected; the client must sign out. */
    error?: "RefreshFailed";
    user: DefaultSession["user"] & {
      id?: string;
      firstName?: string;
      lastName?: string;
    };
  }

  interface User {
    id?: string;
    accessToken: string;
    refreshToken: string;
    firstName?: string;
    lastName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    userId?: string;
    firstName?: string;
    lastName?: string;
    error?: "RefreshFailed";
  }
}
