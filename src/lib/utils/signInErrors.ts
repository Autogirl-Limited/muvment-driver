/**
 * Sign-in messages. Drivers see plain wording; the reference code at the end tells
 * the team the root cause, so ask for it (or a screenshot) when a driver reports one.
 *
 * | Ref    | Root cause                                                                    |
 * | ------ | ----------------------------------------------------------------------------- |
 * | S01    | Security check failed (NextAuth `MissingCSRF`): cookie blocked, lost or stale |
 * | S02    | Sign-in server error (NextAuth `Configuration`): check host logs and env vars |
 * | S03    | The app got no sign-in result from NextAuth                                   |
 * | S04    | Any other NextAuth error: check host logs for `[auth][error]`                 |
 * | C01    | `NEXT_PUBLIC_API_URL` is not set                                              |
 * | N01    | The sign-in request from the phone failed, usually a poor connection          |
 * | B00    | The sign-in server could not reach the backend API                            |
 * | B01    | The backend reported success but sent no tokens                               |
 * | B<nnn> | The backend answered with HTTP status nnn, e.g. B500                          |
 */
const GENERIC = "We couldn't sign you in right now. Please try again in a few minutes.";

const withRef = (message: string, ref: string) => `${message} (Ref: ${ref})`;

export const WRONG_CREDENTIALS_MESSAGE = "Check your email and password, then try again.";

export const SIGN_IN_ERRORS = {
  apiUrlMissing: withRef(GENERIC, "C01"),
  backendUnreachable: withRef(GENERIC, "B00"),
  invalidResponse: withRef(GENERIC, "B01"),
  network: withRef("We couldn't connect. Check your internet connection and try again.", "N01"),
  backendStatus: (status: number) => withRef(GENERIC, `B${status}`),
};

/** Maps a failed NextAuth `signIn` result to the message the driver sees. */
export const getSignInErrorMessage = (error?: string, code?: string) => {
  switch (error) {
    case "CredentialsSignin":
      // `code` carries the message thrown by `authorize` in `src/auth.ts`.
      return code && code !== "credentials" ? code : WRONG_CREDENTIALS_MESSAGE;
    case "MissingCSRF":
      return withRef("We couldn't sign you in. Please close the app, open it again and retry.", "S01");
    case "Configuration":
      return withRef(GENERIC, "S02");
    case undefined:
      return withRef(GENERIC, "S03");
    default:
      return withRef(GENERIC, "S04");
  }
};
