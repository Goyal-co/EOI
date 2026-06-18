import { prisma, Prisma } from "@goyal/db";
import { customerEoiStepSchema } from "@goyal/types";
import { withAuth, apiResponse, apiError } from "@/lib/api";
import { EOIEngine } from "@/lib/services/eoi-engine";
import { encryptFormData } from "@/lib/services/form-data-pii";
import { getSystemSettings } from "@/lib/services/system-settings";

import { resolveCustomerEoi } from "@/lib/customer/eoi-resolver";
import {
  resolveRequiredDocumentTypes,
  formatMissingDocumentLabels,
} from "@/lib/required-documents";

const EDITABLE_STATUSES = ["DRAFT", "PENDING_SUBMISSION", "CORRECTION_REQUESTED"];
const LOCKED_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLOSED"];

export async function GET(req: Request) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const eoiId = searchParams.get("eoiId");

  const eoi = await resolveCustomerEoi(session!.user.id, session!.user.email!, eoiId);

  if (!eoi) return apiResponse(null);

  const full = await prisma.eOI.findUnique({
    where: { id: eoi.id },
    include: {
      lead: true,
      project: { include: { eoiRules: true } },
      documents: true,
      approvalActions: { orderBy: { createdAt: "desc" } },
    },
  });

  return apiResponse(full);
}

export async function PUT(req: Request) {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const eoiIdParam = searchParams.get("eoiId");

  const settings = await getSystemSettings();
  const body = await req.json();
  const parsed = customerEoiStepSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0].message);
  const { step, data, submit } = parsed.data;

  let resolved = await resolveCustomerEoi(session!.user.id, session!.user.email!, eoiIdParam);

  if (!resolved) {
    const lead = await prisma.lead.findFirst({
      where: { customerEmail: session!.user.email!, confirmationStatus: "ACCEPTED" },
    });
    if (!lead) return apiError("No active EOI found");

    resolved = await prisma.eOI.findUnique({ where: { leadId: lead.id } });
    if (!resolved) return apiError("No active EOI found");

    const customer = await prisma.customer.findUnique({
      where: { userId: session!.user.id },
    });
    if (customer) {
      await prisma.eOI.update({
        where: { id: resolved.id },
        data: { customerId: customer.id },
      });
    }
  }

  const eoi = await prisma.eOI.findUnique({
    where: { id: resolved.id },
    include: { documents: true, project: { include: { eoiRules: true } }, lead: true },
  });
  if (!eoi) return apiError("No active EOI found");

  if (!submit && LOCKED_STATUSES.includes(eoi.status) && !settings.permissions.customerCanEditEOI) {
    return apiError("EOI editing is disabled after submission", 403);
  }

  if (eoi.status === "CORRECTION_REQUESTED" && !settings.eoiRules.allowCorrections) {
    return apiError("Corrections are not allowed for this application", 403);
  }

  const currentFormData = (eoi.formData as Record<string, unknown>) || {};
  let stepData = data as Record<string, unknown>;

  if (step === "personal") {
    try {
      const { getKYCProvider } = await import("@goyal/integrations");
      const kyc = getKYCProvider();
      const personal = data as { panNumber?: string; aadhaarNumber?: string };
      const panResult = personal.panNumber ? await kyc.verifyPAN(personal.panNumber) : null;
      const aadhaarResult = personal.aadhaarNumber ? await kyc.verifyAadhaar(personal.aadhaarNumber) : null;
      stepData = {
        ...stepData,
        kycVerification: {
          pan: panResult,
          aadhaar: aadhaarResult,
          verifiedAt: new Date().toISOString(),
        },
      };
    } catch (e) {
      console.error("[KYC] verification failed:", e);
    }
  }

  const updatedFormData = encryptFormData({ ...currentFormData, [step]: stepData });

  if (submit) {
    const bankDetails = (updatedFormData.bankDetails || {}) as { chequeNumber?: string };
    const chequeDoc = eoi.documents.find((d) => d.type === "CHEQUE");

    if (settings.eoiRules.requireCheque) {
      if (!bankDetails.chequeNumber) {
        return apiError("Cancelled cheque number is required");
      }
      if (!chequeDoc) {
        return apiError("Cancelled cheque image upload is required");
      }
    }

    const projectRule = eoi.project.eoiRules[0];
    const requiredTypes = projectRule?.requiredDocuments?.length
      ? resolveRequiredDocumentTypes(projectRule.requiredDocuments)
      : [];

    if (requiredTypes.length > 0) {
      const uploadedTypes = new Set(eoi.documents.map((d) => d.type));
      const missing = requiredTypes.filter((t) => !uploadedTypes.has(t));
      if (missing.length > 0) {
        return apiError(`Missing required documents: ${formatMissingDocumentLabels(missing)}`);
      }
    }

    try {
      if (EDITABLE_STATUSES.includes(eoi.status)) {
        await prisma.eOI.update({
          where: { id: eoi.id },
          data: {
            formData: updatedFormData as Prisma.InputJsonValue,
            status: "DRAFT",
            chequeNumber: bankDetails.chequeNumber,
            chequeUploaded: !!chequeDoc,
          },
        });
        const submitStatus = settings.eoiRules.autoReview ? "UNDER_REVIEW" as const : "SUBMITTED" as const;
        const result = await EOIEngine.transition({
          eoiId: eoi.id,
          toStatus: submitStatus,
          actorId: session!.user.id,
          chequeNumber: bankDetails.chequeNumber,
          chequeUploaded: !!chequeDoc,
        });
        return apiResponse(result);
      }
      return apiError("EOI cannot be submitted in current status");
    } catch (e) {
      return apiError((e as Error).message);
    }
  }

  const updated = await prisma.eOI.update({
    where: { id: eoi.id },
    data: {
      formData: updatedFormData as Prisma.InputJsonValue,
      status: eoi.status === "PENDING_SUBMISSION" ? "DRAFT" : eoi.status,
    },
  });

  await prisma.lead.updateMany({
    where: { id: eoi.leadId },
    data: { journeyStatus: "DRAFT" },
  });

  return apiResponse(updated);
}
