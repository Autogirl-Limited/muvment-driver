/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, EyeOff, Sun, User } from "lucide-react";

import { AiFeedbackCard } from "@/components/checklist/AiFeedbackCard";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCurrentUser, useUploadProfilePhoto } from "@/lib/api/hooks/useUsers";
import { capturePhoto } from "@/lib/utils/deviceActions";

const TIPS = [
  { icon: Sun, text: "Good light on your face" },
  { icon: User, text: "Just you, looking at the camera" },
  { icon: EyeOff, text: "No sunglasses, mask or hat over your eyes" },
];

/**
 * The driver's profile photo, which every driver must have: it is what their
 * daily selfie is compared with. The photo is shrunk here, then checked by
 * the server (one clear, well-lit face) before it is saved.
 *
 * Opened with `?required=1` from the app gate (no way out until a photo is
 * saved), or from Profile to change it.
 */
export default function ProfilePhotoPage() {
  const router = useRouter();
  const isRequired = useSearchParams().get("required") === "1";
  const currentUserQuery = useCurrentUser();
  const currentPhotoUrl = currentUserQuery.data?.data.profilePictureUrl?.trim() || undefined;
  const uploadProfilePhoto = useUploadProfilePhoto();
  const [mountedAt] = useState(() => Date.now());
  const [localUri, setLocalUri] = useState<string>();
  const [savedFeedback, setSavedFeedback] = useState<string>();
  const [rejection, setRejection] = useState<string>();

  const isSaving = uploadProfilePhoto.isPending;
  const isSaved = Boolean(savedFeedback);
  const shownUri = localUri ?? currentPhotoUrl;
  const hasPhoto = Boolean(currentPhotoUrl) || isSaved;

  // Already has a photo (e.g. added on another phone): nothing left to require.
  useEffect(() => {
    if (isRequired && currentUserQuery.dataUpdatedAt >= mountedAt && currentPhotoUrl && !localUri && !savedFeedback) {
      router.replace("/home");
    }
  }, [currentPhotoUrl, currentUserQuery.dataUpdatedAt, isRequired, localUri, mountedAt, router, savedFeedback]);

  const finish = () => router.replace(isRequired ? "/home" : "/profile");

  const takePhoto = async () => {
    const captured = await capturePhoto("user");
    if (!captured) return;

    setLocalUri(captured.previewUrl);
    setSavedFeedback(undefined);
    setRejection(undefined);

    try {
      const result = await uploadProfilePhoto.mutateAsync({ file: captured.file });
      setSavedFeedback(result.feedback || "Your photo looks good.");
    } catch (error) {
      setRejection(getApiErrorMessage(error) ?? "We couldn't save that photo. Please try again.");
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <div className="flex h-[52px] items-center px-2" style={{ paddingTop: "var(--safe-top)", height: "calc(52px + var(--safe-top))" }}>
        {!isRequired && <BackButton label="Profile" href="/profile" />}
      </div>

      <div className="scroll-y min-h-0 flex-1 px-6 pb-6">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="anim-fade-in mt-3 flex justify-center">
            <div className="relative flex h-44 w-44 items-center justify-center">
              {!shownUri && <span className="anim-photo-ring absolute inset-0 rounded-full border-2 border-accent" />}
              <div
                className={`flex h-44 w-44 items-center justify-center overflow-hidden rounded-full bg-accent-soft ${
                  isSaved ? "border-[3px] border-success" : ""
                }`}
              >
                {shownUri ? (
                  <img src={shownUri} alt="Your profile photo" className={`h-full w-full object-cover ${isSaving ? "opacity-60" : ""}`} />
                ) : (
                  <User size={72} strokeWidth={1.5} className="text-accent-text" />
                )}
              </div>
              {isSaved && (
                <span className="anim-scale-in absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-bg bg-success text-white">
                  <Check size={16} strokeWidth={3.5} />
                </span>
              )}
            </div>
          </div>

          <div className="anim-rise-in mt-7">
            <h1 className="text-center text-[28px] font-bold leading-[34px] tracking-[-0.6px] text-text">
              {isSaved ? "Looking Good" : currentPhotoUrl && !isRequired ? "Your Profile Photo" : "Add Your Photo"}
            </h1>
            <p className="mt-2 text-center text-[16px] leading-[22px] text-text-3">
              {isSaved
                ? "Your profile photo is saved."
                : "We use it to confirm it's you when you take your selfie on each Pre-Ride Pilot Report."}
            </p>
            {isSaving ? (
              <AiFeedbackCard tone="processing" headline="Checking your photo…" feedback="Making sure your face is clear." />
            ) : rejection ? (
              <AiFeedbackCard tone="attention" headline="Let's try another" feedback={rejection} />
            ) : savedFeedback ? (
              <AiFeedbackCard tone="good" headline="Photo saved" feedback={savedFeedback} />
            ) : null}
          </div>

          {!isSaved && (
            <ul className="card anim-rise-in mt-6 divide-y divide-separator p-0 py-1.5" style={{ animationDelay: "120ms" }}>
              {TIPS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent-soft text-accent-text">
                    <Icon size={15} strokeWidth={2.25} />
                  </span>
                  <span className="text-[15px] text-text">{text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="px-6 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2.5">
          {isSaved || (hasPhoto && !isRequired && !rejection && !localUri) ? (
            <>
              <Button onClick={finish}>{isRequired ? "Continue" : "Done"}</Button>
              <Button variant="outline" onClick={() => void takePhoto()}>
                Retake Photo
              </Button>
            </>
          ) : (
            <Button loading={isSaving} icon={<Camera size={18} />} onClick={() => void takePhoto()}>
              {isSaving ? "Checking Photo…" : rejection ? "Retake Photo" : "Take Photo"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
