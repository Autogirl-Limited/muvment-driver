import { CheckCircle2, Circle } from "lucide-react";

export const getPasswordRequirements = (password: string) => ({
  digit: /\d/.test(password),
  length: password.length >= 8,
  lowercase: /[a-z]/.test(password),
  noSpaces: password.length > 0 && !/\s/.test(password),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  uppercase: /[A-Z]/.test(password),
});

export const isPasswordValid = (password: string) =>
  Object.values(getPasswordRequirements(password)).every(Boolean);

const Item = ({ isValid, label }: { isValid: boolean; label: string }) => (
  <li className={`text-callout flex items-center gap-2 transition-colors ${isValid ? "text-success-text" : "text-text-2"}`}>
    {isValid ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} className="text-text-4" />}
    {label}
  </li>
);

export const PasswordRequirementChecklist = ({ password }: { password: string }) => {
  const requirements = getPasswordRequirements(password);

  return (
    <div className="anim-rise-in mt-1 mb-6 rounded-xl bg-surface-alt px-4 py-3">
      <p className="text-callout mb-2 font-medium text-text">Password must include at least:</p>
      <ul className="space-y-1.5">
        <Item label="8 characters long" isValid={requirements.length} />
        <Item label="One uppercase character" isValid={requirements.uppercase} />
        <Item label="One lowercase character" isValid={requirements.lowercase} />
        <Item label="One digit" isValid={requirements.digit} />
        <Item label="One special character" isValid={requirements.special} />
        <Item label="Must not include spaces" isValid={requirements.noSpaces} />
      </ul>
    </div>
  );
};
