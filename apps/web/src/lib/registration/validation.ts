import { cpRegisterStep1Schema, cpRegisterStep2Schema, type CPRegisterStep1, type CPRegisterStep2 } from "@goyal/types";

export function isRegistrationStepValid(step: 0 | 1, step1: CPRegisterStep1, step2: CPRegisterStep2): boolean {
  if (step === 0) return cpRegisterStep1Schema.safeParse(step1).success;
  return cpRegisterStep2Schema.safeParse(step2).success;
}

export function getRegistrationStepHints(step: 0 | 1, step1: CPRegisterStep1, step2: CPRegisterStep2): string[] {
  if (step === 0) {
    const hints: string[] = [];
    if (step1.fullName.length < 2) hints.push("Full name must be at least 2 characters");
    if (!/^[6-9]\d{9}$/.test(step1.mobile)) hints.push("Mobile must be a 10-digit Indian number starting with 6–9");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.email)) hints.push("Enter a valid email address");
    if (step1.password.length < 8) hints.push("Password must be at least 8 characters");
    if (step1.password !== step1.confirmPassword) hints.push("Passwords must match");
    return hints;
  }

  const hints: string[] = [];
  if (step2.reraNumber.length < 5) hints.push("RERA number must be at least 5 characters");
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(step2.panNumber)) {
    hints.push("PAN must match format ABCDE1234F (5 letters, 4 digits, 1 letter)");
  }
  return hints;
}
