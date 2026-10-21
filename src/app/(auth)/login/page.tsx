"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Wordmark } from "@/components/layout/Logo";
import { useToast } from "@/providers/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [backendError, setBackendError] = useState<string>();

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFormValid || isPending) {
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
        const message =
          result?.code && result.code !== "credentials"
            ? result.code
            : "Please check your email and password";

        setBackendError(message);
        toast.error("Login failed", message);
        return;
      }

      toast.success("Login Successful");
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/home");
      router.refresh();
    } catch {
      const message = "Unable to reach the server. Please check your connection and try again.";

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
            label="Email Address"
            placeholder="Enter your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            autoCorrect="off"
          />

          <TextField
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            isPassword
            autoComplete="current-password"
            hasError={Boolean(backendError)}
            errorMessage={backendError}
          />

          <div className="mt-1 mb-8 flex justify-end">
            <Link href="/reset-password" className="text-callout pressable-soft font-medium text-accent">
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" disabled={!isFormValid} loading={isPending}>
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
