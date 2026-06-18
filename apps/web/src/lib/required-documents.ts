import type { DocumentType } from "@goyal/types";

export const CUSTOMER_EOI_DOCUMENT_TYPES = ["PAN", "AADHAAR", "CHEQUE"] as const;
export type CustomerEoiDocumentType = (typeof CUSTOMER_EOI_DOCUMENT_TYPES)[number];

export const CUSTOMER_DOCUMENT_LABELS: Record<CustomerEoiDocumentType, string> = {
  PAN: "PAN Card",
  AADHAAR: "Aadhaar Card",
  CHEQUE: "EOI Cheque",
};

const LABEL_TO_TYPE: Record<string, CustomerEoiDocumentType> = {
  cheque: "CHEQUE",
  "eoi cheque": "CHEQUE",
  "cancelled cheque": "CHEQUE",
  pan: "PAN",
  "pan card": "PAN",
  aadhaar: "AADHAAR",
  "aadhaar card": "AADHAAR",
  "adhaar card": "AADHAAR",
  adhaar: "AADHAAR",
};

export function normalizeRequiredDocumentType(value: string): CustomerEoiDocumentType | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (CUSTOMER_EOI_DOCUMENT_TYPES.includes(upper as CustomerEoiDocumentType)) {
    return upper as CustomerEoiDocumentType;
  }

  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  return LABEL_TO_TYPE[key] ?? null;
}

export function resolveRequiredDocumentTypes(required: string[]): CustomerEoiDocumentType[] {
  const types = new Set<CustomerEoiDocumentType>();
  for (const entry of required) {
    const normalized = normalizeRequiredDocumentType(entry);
    if (normalized) types.add(normalized);
  }
  return [...types];
}

export function formatMissingDocumentLabels(types: CustomerEoiDocumentType[]): string {
  return types.map((t) => CUSTOMER_DOCUMENT_LABELS[t]).join(", ");
}
