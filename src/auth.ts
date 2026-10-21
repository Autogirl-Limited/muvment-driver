import NextAuth, { CredentialsSignin } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";

import type {
  ApiErrorResponse,
  LoginResponse,
  RefreshTokenResponse,
} from "@/lib/api/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "";

/** Thrown from `authorize` so the login form can show the backend's own message. */
class LoginError extends CredentialsSignin {
  constructor(message: string) {
    super(message);
    this.code = message;
  }
}

const getApiMessage = (payload: unknown, fallback: string) => {
  const message = (payload as ApiErrorResponse | undefined)?.message;

  if (Array.isArray(message)) {
    return message.join("\n");
  }

  return typeof message === "string" && message ? message : fallback;
};

/** Reads the `exp` claim of a JWT access token, in ms. Returns undefined for opaque tokens. */
const getTokenExpiryMs = (token: string): number | undefined => {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return undefined;
    }

    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { exp?: number };

    return typeof json.exp === "number" ? json.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
};

const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshFailed" };
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => undefined)) as
      | RefreshTokenResponse
      | undefined;
    const accessToken = payload?.data?.accessToken;

    if (!response.ok || !accessToken) {
      return { ...token, error: "RefreshFailed" };
    }

    return {
      ...token,
      accessToken,
      accessTokenExpiresAt: getTokenExpiryMs(accessToken),
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshFailed" };
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    // Backend refresh tokens are long-lived; keep the browser session for 30 days.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Muvment",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          throw new LoginError("Please enter your email and password.");
        }

        if (!API_URL) {
          throw new LoginError("The API URL is not configured.");
        }

        let response: Response;

        try {
          response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
          });
        } catch {
          throw new LoginError(
            "Unable to reach the server. Please check your connection and try again.",
          );
        }

        const payload = (await response.json().catch(() => undefined)) as
          | LoginResponse
          | ApiErrorResponse
          | undefined;

        if (!response.ok) {
          throw new LoginError(
            getApiMessage(payload, "Please check your email and password."),
          );
        }

        const data = (payload as LoginResponse | undefined)?.data;

        if (!data?.accessToken || !data.refreshToken) {
          throw new LoginError("Invalid login response from server. Please try again.");
        }

        return {
          id: data.userId,
          email: data.email,
          name: [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpiresAt: getTokenExpiryMs(user.accessToken),
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          error: undefined,
        };
      }

      // The client calls `update({ refresh: true })` after a 401 from the API.
      if (trigger === "update" && (session as { refresh?: boolean } | undefined)?.refresh) {
        return refreshAccessToken(token);
      }

      // Proactive refresh 60s before a JWT access token expires.
      if (
        token.accessTokenExpiresAt &&
        Date.now() > token.accessTokenExpiresAt - 60_000 &&
        !token.error
      ) {
        return refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.user = {
        ...session.user,
        id: token.userId ?? session.user?.id ?? "",
        firstName: token.firstName,
        lastName: token.lastName,
      };

      return session;
    },
  },
});
