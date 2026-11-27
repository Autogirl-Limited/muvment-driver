"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Wordmark } from "@/components/layout/Logo";
import { getSignInErrorMessage, SIGN_IN_ERRORS } from "@/lib/utils/signInErrors";
import { storage } from "@/lib/utils/storage";
import { useToast } from "@/providers/ToastProvider";

const LAST_EMAIL_KEY = "last-signed-in-email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [backendError, setBackendError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  // Remember the last signed-in email, so a returning driver only types a password.
  useEffect(() => {
    const remembered = storage.get(LAST_EMAIL_KEY);

    if (remembered) {
      setEmail((current) => current || remembered);
    }
  }, []);

  const validate = () => {
    const trimmed = email.trim();
    const nextEmailError = !trimmed
      ? "Enter your email address."
      : !EMAIL_PATTERN.test(trimmed)
        ? "Enter a valid email address, like name@example.com."
        : undefined;
    const nextPasswordError = password ? undefined : "Enter your password.";

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    return !nextEmailError && !nextPasswordError;
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (isPending || !validate()) {
      return;
    }

    setIsPending(true);
    setBackendError(undefined);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        const message = getSignInErrorMessage(result?.error, result?.code);

        setBackendError(message);
        toast.error("Login failed", message);
        return;
      }

      storage.set(LAST_EMAIL_KEY, email.trim());
      toast.success("Login Successful");
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/home");
      router.refresh();
    } catch {
      const message = SIGN_IN_ERRORS.network;

      setBackendError(message);
      toast.error("Login failed", message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Screen className="safe-top justify-center px-6">
      <div className="anim-rise-in mx-auto w-full max-w-sm py-10">
        <div className="mb-10 flex flex-col items-center">
          <Link href="/" className="pressable-soft">
            <Wordmark />
          </Link>
          <p className="text-body mt-3 font-medium text-text-2">Professional Driver Portal</p>
        </div>

        <form onSubmit={handleLogin} noValidate>
          <TextField
            floating
            label="Email address"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(undefined);
              setBackendError(undefined);
            }}
            hasError={Boolean(emailError)}
            errorMessage={emailError}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
          />

          <TextField
            floating
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(undefined);
              setBackendError(undefined);
            }}
            isPassword
            autoComplete="current-password"
            hasError={Boolean(backendError || passwordError)}
            errorMessage={passwordError ?? backendError}
          />

          <div className="mt-1 mb-8 flex justify-end">
            <Link href="/reset-password" className="text-callout pressable-soft font-medium text-accent">
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" loading={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </Button>

          <div className="h-4" />

          <Button variant="outline" onClick={() => router.push("/become-driver")}>
            Become a Driver
          </Button>
        </form>
      </div>
    </Screen>
  );
}
