import type { CRMProvider } from "../types";

type GoyalEoiPayload = {
  fullName: string;
  phone: string;
  email?: string;
  projectName?: string;
  projectId?: string;
  city?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  communicationAddress?: string;
  permanentAddress?: string;
  occupation?: string;
  organizationName?: string;
  designation?: string;
  sourceOfFund?: string;
  sourceOfEnquiry?: string;
};

function baseUrl() {
  return (process.env.GOYAL_CRM_API_URL || "https://goyalhariyanacrm.in/api").replace(/\/$/, "");
}

function apiKey() {
  return process.env.EOI_API_KEY?.trim() || "";
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function compact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

/** Map flexible EOI_CP lead/EOI fields → Goyal CRM webhook body. */
export function mapToGoyalEoiPayload(data: Record<string, unknown>): GoyalEoiPayload | null {
  const fullName =
    str(data.fullName) ||
    str(data.customerName) ||
    "EOI Lead";
  const phone =
    str(data.phone) ||
    str(data.mobile) ||
    str(data.customerMobile) ||
    str(data.customerPhone);

  if (!phone) return null;

  return {
    fullName,
    phone,
    email: str(data.email) || str(data.customerEmail),
    projectName: str(data.projectName),
    projectId: str(data.projectId) || str(data.crmProjectId),
    city: str(data.city),
    dateOfBirth: str(data.dateOfBirth) || str(data.dob),
    maritalStatus: str(data.maritalStatus),
    nationality: str(data.nationality) || "Indian",
    communicationAddress:
      str(data.communicationAddress) ||
      str(data.currentAddress) ||
      str(data.address),
    permanentAddress: str(data.permanentAddress) || str(data.currentAddress),
    occupation: str(data.occupation),
    organizationName: str(data.organizationName) || str(data.companyName),
    designation: str(data.designation) || str(data.fosName),
    sourceOfFund: str(data.sourceOfFund),
    sourceOfEnquiry:
      str(data.sourceOfEnquiry) ||
      (str(data.intentType) === "LEAD_ONLY" ? "Partner Portal Lead" : "Partner Portal EOI"),
  };
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function messageFromBody(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.message === "string") return o.message;
  if (Array.isArray(o.message)) return o.message.map(String).join(", ");
  if (typeof o.error === "string") return o.error;
  return fallback;
}

async function postWebhook(path: string, payload: GoyalEoiPayload, key: string) {
  const body = compact({
    ...(payload as unknown as Record<string, unknown>),
    api_key: key,
  });

  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-EOI-Api-Key": key,
    },
    body: JSON.stringify(body),
  });

  const parsed = await parseJson(res);
  if (!res.ok) {
    throw new Error(messageFromBody(parsed, `Goyal CRM webhook failed (${res.status})`));
  }
  if (parsed && typeof parsed === "object" && (parsed as { success?: boolean }).success === false) {
    throw new Error(messageFromBody(parsed, "Goyal CRM webhook rejected"));
  }
  return parsed;
}

function crmIdFromResponse(body: unknown, phone: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  if (typeof o.leadCode === "string" && o.leadCode) return o.leadCode;
  if (typeof o.id === "string" && o.id) return o.id;
  if (o.duplicate) return `duplicate-${phone}`;
  return undefined;
}

async function punch(data: Record<string, unknown>): Promise<{ success: boolean; crmId?: string }> {
  const key = apiKey();
  if (!key) {
    console.warn("[Goyal CRM] EOI_API_KEY not configured — skipping punch");
    return { success: false };
  }

  const payload = mapToGoyalEoiPayload(data);
  if (!payload) {
    console.warn("[Goyal CRM] missing phone — skipping punch", { keys: Object.keys(data) });
    return { success: false };
  }

  let body: unknown;
  try {
    body = await postWebhook("/webhooks/eoi", payload, key);
  } catch (err) {
    console.warn("[Goyal CRM] /webhooks/eoi failed, trying /eoi/create", err);
    body = await postWebhook("/eoi/create", payload, key);
  }

  const crmId = crmIdFromResponse(body, payload.phone);
  console.log("[Goyal CRM] lead punched", {
    phone: payload.phone,
    projectName: payload.projectName,
    crmId,
    duplicate: Boolean((body as { duplicate?: boolean } | null)?.duplicate),
  });

  return { success: true, crmId };
}

export const goyalCRMProvider: CRMProvider = {
  async syncLead(data) {
    return punch(data);
  },
  async syncEOI(data) {
    return punch({
      ...data,
      sourceOfEnquiry: str(data.sourceOfEnquiry) || "Customer EOI Portal",
    });
  },
};
