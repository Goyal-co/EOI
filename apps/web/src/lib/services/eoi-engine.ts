import { prisma } from "@goyal/db";
import { canTransitionEOI, generateEOIReference, type EOIStatus } from "@goyal/types";
import { NotificationService } from "@goyal/email";
import { getCRMProvider } from "@goyal/integrations";
import { writeAudit } from "./audit";
import { getSystemSettings } from "./system-settings";

export class EOIEngine {
  static async transition(params: {
    eoiId: string;
    toStatus: EOIStatus;
    actorId: string;
    reason?: string;
    remarks?: string;
    action?: "APPROVE" | "REJECT" | "REQUEST_CORRECTION";
    chequeNumber?: string;
    chequeUploaded?: boolean;
    expectedStatus?: EOIStatus;
  }) {
    const eoi = await prisma.eOI.findUnique({
      where: { id: params.eoiId },
      include: {
        lead: true,
        project: true,
        cp: { include: { user: true } },
        customer: { include: { user: true } },
        documents: true,
      },
    });

    if (!eoi) throw new Error("EOI not found");

    if (params.expectedStatus && eoi.status !== params.expectedStatus) {
      throw new Error(`EOI status changed from ${params.expectedStatus} to ${eoi.status}`);
    }

    if (!canTransitionEOI(eoi.status as EOIStatus, params.toStatus)) {
      throw new Error(`Cannot transition from ${eoi.status} to ${params.toStatus}`);
    }

    const settings = await getSystemSettings();
    let targetStatus = params.toStatus;

    if (params.toStatus === "SUBMITTED" && settings.eoiRules.autoReview) {
      targetStatus = "UNDER_REVIEW";
    }

    if (params.toStatus === "APPROVED" && !settings.permissions.requireAdminApproval) {
      // still allow explicit admin approve; auto-approve handled on submit via autoReview
    }

    const referenceNumber = targetStatus === "SUBMITTED" || targetStatus === "UNDER_REVIEW"
      ? (eoi.referenceNumber || generateEOIReference())
      : eoi.referenceNumber;

    const confirmationNumber = params.toStatus === "APPROVED" && !eoi.confirmationNumber
      ? referenceNumber || generateEOIReference()
      : eoi.confirmationNumber;

    const journeyMap: Record<string, string> = {
      DRAFT: "DRAFT",
      SUBMITTED: "SUBMITTED",
      UNDER_REVIEW: "SUBMITTED",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
      CORRECTION_REQUESTED: "CORRECTION_PENDING",
    };

    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.eOI.updateMany({
        where: { id: params.eoiId, status: eoi.status },
        data: {
          status: targetStatus,
          referenceNumber,
          confirmationNumber,
          chequeNumber: params.chequeNumber ?? eoi.chequeNumber,
          chequeUploaded: params.chequeUploaded ?? eoi.chequeUploaded,
          adminRemarks: params.remarks ?? eoi.adminRemarks,
          rejectionReason: params.reason ?? eoi.rejectionReason,
          submittedAt: (targetStatus === "SUBMITTED" || targetStatus === "UNDER_REVIEW") ? new Date() : eoi.submittedAt,
          approvedAt: params.toStatus === "APPROVED" ? new Date() : eoi.approvedAt,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("EOI status changed by another process");
      }

      const result = await tx.eOI.findUniqueOrThrow({ where: { id: params.eoiId } });

      if (params.action) {
        await tx.approvalAction.create({
          data: {
            eoiId: params.eoiId,
            adminId: params.actorId,
            action: params.action,
            reason: params.reason,
            remarks: params.remarks,
          },
        });
      }

      const journeyStatus = journeyMap[targetStatus] || journeyMap[params.toStatus];
      if (journeyStatus) {
        await tx.lead.update({
          where: { id: eoi.leadId },
          data: { journeyStatus: journeyStatus as never },
        });
      }

      await writeAudit(
        {
          actorId: params.actorId,
          action: `EOI_${targetStatus}`,
          entityType: "EOI",
          entityId: params.eoiId,
          metadata: { from: eoi.status, to: targetStatus, reason: params.reason },
        },
        tx
      );

      return result;
    });

    if (
      (targetStatus === "SUBMITTED" || targetStatus === "UNDER_REVIEW")
      && !["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CORRECTION_REQUESTED", "CLOSED"].includes(eoi.status)
    ) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
      for (const admin of admins) {
        await NotificationService.notifyEOISubmitted({
          adminUserId: admin.id,
          customerName: eoi.lead.customerName,
          projectName: eoi.project.name,
          eoiId: eoi.id,
        });
      }

      if (eoi.customer?.user) {
        await NotificationService.notifyCustomerEOISubmitted({
          customerUserId: eoi.customer.user.id,
          customerEmail: eoi.customer.user.email,
          customerName: eoi.lead.customerName,
          projectName: eoi.project.name,
          referenceNumber: referenceNumber!,
        });
      }

      if (eoi.cp.user) {
        await NotificationService.notifyCPCustomerSubmitted({
          cpUserId: eoi.cp.user.id,
          cpEmail: eoi.cp.user.email,
          cpName: eoi.cp.user.name || "Partner",
          customerName: eoi.lead.customerName,
          projectName: eoi.project.name,
          referenceNumber: referenceNumber!,
          eoiId: eoi.id,
        });
      }

      try {
        const crm = getCRMProvider();
        await crm.syncEOI({
          customerName: eoi.lead.customerName,
          projectName: eoi.project.name,
          referenceNumber: referenceNumber!,
        });
      } catch (e) {
        console.error("[CRM] syncEOI failed:", e);
      }
    }

    if (params.toStatus === "APPROVED" && eoi.customer?.user) {
      await NotificationService.notifyEOIApproved({
        customerUserId: eoi.customer.user.id,
        customerEmail: eoi.customer.user.email,
        customerName: eoi.lead.customerName,
        projectName: eoi.project.name,
        confirmationNumber: confirmationNumber!,
        cpUserId: eoi.cp.user?.id,
      });
    }

    if (params.toStatus === "REJECTED" && eoi.customer?.user) {
      await NotificationService.notifyEOIRejected({
        customerUserId: eoi.customer.user.id,
        customerEmail: eoi.customer.user.email,
        customerName: eoi.lead.customerName,
        projectName: eoi.project.name,
        reason: params.reason || "Not specified",
        remarks: params.remarks,
        cpUserId: eoi.cp.user?.id,
      });
    }

    if (params.toStatus === "CORRECTION_REQUESTED" && eoi.customer?.user) {
      await NotificationService.notifyCorrectionRequested({
        customerUserId: eoi.customer.user.id,
        customerEmail: eoi.customer.user.email,
        customerName: eoi.lead.customerName,
        projectName: eoi.project.name,
        remarks: params.remarks || "Please review and resubmit",
      });
    }

    return updated;
  }
}
