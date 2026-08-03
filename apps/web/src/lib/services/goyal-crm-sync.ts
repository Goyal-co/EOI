import { prisma } from "@goyal/db";
import { getCRMProvider } from "@goyal/integrations";
import { decryptFormData } from "@/lib/services/form-data-pii";

type PunchResult = { success: boolean; crmId?: string };

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Punch partner-created lead/EOI to Goyal Hariyana CRM and persist crm id. */
export async function punchPartnerLeadToCrm(params: {
  leadDbId: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  projectName: string;
  city?: string | null;
  fosName?: string | null;
  notes?: string | null;
  intentType: "EOI" | "LEAD_ONLY";
  publicLeadId?: string | null;
}): Promise<PunchResult> {
  try {
    const crm = getCRMProvider();
    const result = await crm.syncLead({
      fullName: params.customerName,
      customerName: params.customerName,
      phone: params.customerMobile,
      mobile: params.customerMobile,
      email: params.customerEmail,
      projectName: params.projectName,
      city: params.city || undefined,
      fosName: params.fosName || undefined,
      notes: params.notes || undefined,
      intentType: params.intentType,
      sourceOfEnquiry:
        params.intentType === "LEAD_ONLY" ? "Partner Portal Lead" : "Partner Portal EOI",
      leadId: params.publicLeadId || undefined,
      nationality: "Indian",
    });

    if (result.crmId) {
      await prisma.lead.update({
        where: { id: params.leadDbId },
        data: { titanCrmId: result.crmId },
      });
    }
    return result;
  } catch (e) {
    console.error("[Goyal CRM] punchPartnerLeadToCrm failed:", e);
    return { success: false };
  }
}

/** Punch submitted customer EOI (with KYC/address when available) to Goyal CRM. */
export async function punchSubmittedEoiToCrm(params: {
  leadDbId: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  projectName: string;
  city?: string | null;
  referenceNumber?: string | null;
  formData?: unknown;
  existingCrmId?: string | null;
}): Promise<PunchResult> {
  try {
    const form = decryptFormData(asRecord(params.formData));
    const personal = asRecord(form.personal);
    const address = asRecord(form.address);

    const crm = getCRMProvider();
    const result = await crm.syncEOI({
      fullName: String(personal.fullName || params.customerName),
      customerName: params.customerName,
      phone: String(personal.mobile || params.customerMobile),
      mobile: String(personal.mobile || params.customerMobile),
      email: String(personal.email || params.customerEmail),
      projectName: params.projectName,
      city: String(address.city || params.city || "") || undefined,
      dateOfBirth: typeof personal.dob === "string" ? personal.dob : undefined,
      communicationAddress:
        typeof address.currentAddress === "string" ? address.currentAddress : undefined,
      permanentAddress:
        typeof address.currentAddress === "string" ? address.currentAddress : undefined,
      occupation: typeof address.occupation === "string" ? address.occupation : undefined,
      organizationName:
        typeof address.companyName === "string" ? address.companyName : undefined,
      nationality: "Indian",
      sourceOfEnquiry: "Customer EOI Portal",
      referenceNumber: params.referenceNumber || undefined,
    });

    if (result.crmId && result.crmId !== params.existingCrmId) {
      await prisma.lead.update({
        where: { id: params.leadDbId },
        data: { titanCrmId: result.crmId },
      });
    }
    return result;
  } catch (e) {
    console.error("[Goyal CRM] punchSubmittedEoiToCrm failed:", e);
    return { success: false };
  }
}
