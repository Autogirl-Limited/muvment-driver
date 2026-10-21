"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCreateDriverApplication } from "@/lib/api/hooks/useDriverApplications";
import { useToast } from "@/providers/ToastProvider";

export default function BecomeDriverPage() {
  const router = useRouter();
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [experience, setExperience] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const createDriverApplication = useCreateDriverApplication();

  const yearsOfExperience = Number(experience);
  const isFormValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    experience.trim().length > 0 &&
    Number.isFinite(yearsOfExperience) &&
    yearsOfExperience >= 0 &&
    phone.trim().length > 0;
  const backendError = getApiErrorMessage(createDriverApplication.error);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFormValid || createDriverApplication.isPending) {
      return;
    }

    try {
      await createDriverApplication.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        primaryPhoneNumber: phone.trim(),
        yearsOfExperience,
        ...(altPhone.trim() ? { alternativePhoneNumber: altPhone.trim() } : {}),
      });

      toast.success("Application Submitted!", "We will review your credentials and contact you soon.");
      router.push("/bd-success");
    } catch (error) {
      toast.error("Application failed", getApiErrorMessage(error) || "Please check your details and try again");
    }
  };

  return (
    <Screen>
      <NavBar left={<BackButton href="/login" />} />
      <div className="anim-rise-in px-6 pt-2 pb-10">
        <h1 className="text-large-title mb-2 text-text">Become a Driver</h1>
        <p className="text-body mb-8 text-text-2">Apply to become a driver by submitting your credentials</p>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="Full Name"
            placeholder="e.g Jeffry Dolapo Ayo"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextField
            label="Email Address"
            placeholder="name@gmail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label="Driving Experience (Years)"
            placeholder="e.g 4"
            value={experience}
            onChange={(event) => setExperience(event.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="numeric"
          />
          <TextField
            label="Phone Number"
            placeholder="090 1234 5678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
          />
          <TextField
            label="Alt. Phone Number (Optional)"
            placeholder="090 1234 5678"
            value={altPhone}
            onChange={(event) => setAltPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            hasError={Boolean(backendError)}
            errorMessage={backendError}
          />

          <div className="mt-6">
            <Button type="submit" disabled={!isFormValid} loading={createDriverApplication.isPending}>
              {createDriverApplication.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </Screen>
  );
}
