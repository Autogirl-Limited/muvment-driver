"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { NavBar, Screen } from "@/components/ui/Screen";
import { PhoneNumberField } from "@/components/ui/PhoneNumberField";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCreateDriverApplication } from "@/lib/api/hooks/useDriverApplications";
import { countryName, emptyPhone, isPhoneEmpty, toE164, type PhoneValue } from "@/lib/utils/phone";
import { useToast } from "@/providers/ToastProvider";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Field = "fullName" | "email" | "phone" | "altPhone" | "experience";
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_ORDER: Field[] = ["fullName", "email", "phone", "altPhone", "experience"];

const validateName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your full name.";
  if (trimmed.split(/\s+/).length < 2) return "Enter your first and last name.";
  return undefined;
};

const validateEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address, like name@example.com.";
  return undefined;
};

const validatePhone = (value: PhoneValue, required: boolean) => {
  if (isPhoneEmpty(value)) return required ? "Enter your phone number." : undefined;
  if (!toE164(value)) return `Enter a valid ${countryName(value.country)} phone number.`;
  return undefined;
};

export default function BecomeDriverPage() {
  const router = useRouter();
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [experience, setExperience] = useState("");
  const [phone, setPhone] = useState<PhoneValue>(() => emptyPhone());
  /** null while the driver hasn't asked for a second number. */
  const [altPhone, setAltPhone] = useState<PhoneValue | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const createDriverApplication = useCreateDriverApplication();
  const refs: Record<Field, React.RefObject<HTMLInputElement | null>> = {
    fullName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    altPhone: useRef<HTMLInputElement>(null),
    experience: useRef<HTMLInputElement>(null),
  };

  const submitError = getApiErrorMessage(createDriverApplication.error);

  const clearError = (field: Field) => {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (createDriverApplication.error) createDriverApplication.reset();
  };

  const validateAltPhone = (value: PhoneValue | null) => {
    if (!value) return undefined;
    const message = validatePhone(value, false);
    if (message) return message;
    const primary = toE164(phone);

    return primary && toE164(value) === primary
      ? "This is the same as your main number. Add a different one, or remove it."
      : undefined;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (createDriverApplication.isPending) return;

    const yearsOfExperience = Number(experience);
    const next: FieldErrors = {
      fullName: validateName(fullName),
      email: validateEmail(email),
      phone: validatePhone(phone, true),
      altPhone: validateAltPhone(altPhone),
      experience:
        experience.trim() === "" || !Number.isFinite(yearsOfExperience) || yearsOfExperience < 0
          ? "Enter your years of driving experience."
          : undefined,
    };
    const invalid = FIELD_ORDER.filter((field) => next[field]);

    if (invalid.length) {
      setErrors(next);
      refs[invalid[0]].current?.focus();
      if ("vibrate" in navigator) navigator.vibrate?.(12);
      return;
    }

    setErrors({});
    const alternativePhoneNumber = altPhone ? toE164(altPhone) : undefined;

    try {
      await createDriverApplication.mutateAsync({
        fullName: fullName.trim().replace(/\s+/g, " "),
        email: email.trim(),
        // Always "+<country code><number>", e.g. +2348012345678.
        primaryPhoneNumber: toE164(phone)!,
        yearsOfExperience,
        ...(alternativePhoneNumber ? { alternativePhoneNumber } : {}),
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
            ref={refs.fullName}
            floating
            label="Full Name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              clearError("fullName");
            }}
            autoCapitalize="words"
            autoComplete="name"
            errorMessage={errors.fullName}
          />
          <TextField
            ref={refs.email}
            floating
            label="Email Address"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            errorMessage={errors.email}
          />
          <PhoneNumberField
            ref={refs.phone}
            label="Phone Number"
            value={phone}
            onChange={(value) => {
              setPhone(value);
              clearError("phone");
            }}
            errorMessage={errors.phone}
            action={altPhone ? undefined : { label: "Add another number", onClick: () => setAltPhone(emptyPhone(phone.country)) }}
          />
          {altPhone && (
            <PhoneNumberField
              ref={refs.altPhone}
              label="Alternative Phone Number"
              value={altPhone}
              onChange={(value) => {
                setAltPhone(value);
                clearError("altPhone");
              }}
              errorMessage={errors.altPhone}
              action={{
                label: "Remove",
                onClick: () => {
                  setAltPhone(null);
                  clearError("altPhone");
                },
              }}
            />
          )}
          <TextField
            ref={refs.experience}
            floating
            label="Driving Experience (Years)"
            value={experience}
            onChange={(event) => {
              setExperience(event.target.value.replace(/[^0-9.]/g, ""));
              clearError("experience");
            }}
            inputMode="numeric"
            errorMessage={errors.experience}
          />

          {submitError && (
            <p role="alert" className="text-footnote mb-3 ml-1 text-danger">
              {submitError}
            </p>
          )}

          <div className="mt-6">
            <Button type="submit" loading={createDriverApplication.isPending}>
              {createDriverApplication.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </Screen>
  );
}
