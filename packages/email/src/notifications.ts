import { prisma, NotificationType } from "@goyal/db";
import { sendEmailWithLog, processEmailRetryQueue } from "./email-log";
import { shouldSendEmail, shouldCreateInAppNotification, isAdminNotificationEnabled, getSupportEmail } from "./prefs";
import { resolveEmailTemplate } from "./template-loader";
import { getAppBaseUrl } from "./urls";
import {
  cpRegistrationAckEmailHtml,
  cpCredentialsEmailHtml,
  customerConfirmationEmailHtml,
  invitationEmailHtml,
  eoiSubmittedEmailHtml,
  eoiApprovedEmailHtml,
  eoiRejectedEmailHtml,
  correctionRequestedEmailHtml,
  cpRegisteredEmailHtml,
  cpCustomerSubmittedEmailHtml,
  cpCustomerRejectedEmailHtml,
  leadOnlyAcceptedEmailHtml,
} from "./templates";

export class NotificationService {
  private static async resolveEmail(
    type: string,
    vars: Record<string, string>,
    fallback: { subject: string; html: string },
  ) {
    return resolveEmailTemplate(type, vars, fallback);
  }

  private static async deliverEmail(params: {
    to: string;
    subject: string;
    html: string;
    type?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
  }) {
    if (params.type && !(await shouldSendEmail(params.userId, params.type))) {
      console.info("[Email] Skipped (preferences):", params.type, "to", params.to);
      return { success: true, skipped: true };
    }
    await processEmailRetryQueue(5);
    const result = await sendEmailWithLog(params);
    if (!result.success) {
      console.error("[Email] Delivery failed:", params.type, result.error);
    }
    return result;
  }

  static async emit(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
    email?: { to: string; subject: string; html: string };
    emailType?: string;
  }) {
    if (await shouldCreateInAppNotification(params.userId, params.type)) {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          entityType: params.entityType,
          entityId: params.entityId,
        },
      });
    }

    if (params.email) {
      await this.deliverEmail({
        to: params.email.to,
        subject: params.email.subject,
        html: params.email.html,
        type: params.emailType || params.type,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
      });
    }
  }

  static async notifyCPRegistrationAck(params: { cpEmail: string; cpName: string }) {
    const email = await this.resolveEmail(
      "CP_REGISTRATION_ACK",
      { cpName: params.cpName, email: params.cpEmail },
      {
        subject: "Registration Received — Goyal Projects",
        html: cpRegistrationAckEmailHtml({ cpName: params.cpName, email: params.cpEmail }),
      },
    );
    await this.deliverEmail({
      to: params.cpEmail,
      subject: email.subject,
      html: email.html,
      type: "CP_REGISTRATION_ACK",
    });
  }

  static async notifyCPApproved(params: {
    cpUserId: string;
    cpEmail: string;
    cpName: string;
    loginUrl: string;
  }) {
    const email = await this.resolveEmail(
      "CP_APPROVED",
      { cpName: params.cpName, email: params.cpEmail, loginUrl: params.loginUrl },
      {
        subject: "Your CP Account is Approved — Goyal Projects",
        html: cpCredentialsEmailHtml({
          cpName: params.cpName,
          email: params.cpEmail,
          loginUrl: params.loginUrl,
        }),
      },
    );
    await this.emit({
      userId: params.cpUserId,
      type: "CP_APPROVED",
      title: "Account Approved",
      body: "Your Channel Partner account has been approved. You can now log in.",
      email: {
        to: params.cpEmail,
        subject: email.subject,
        html: email.html,
      },
    });
  }

  static async notifyCustomerConfirmation(params: {
    customerEmail: string;
    customerName: string;
    cpName: string;
    companyName?: string;
    projectName: string;
    projectLocation: string;
    acceptUrl: string;
    rejectUrl: string;
    entityId?: string;
  }) {
    const email = await this.resolveEmail(
      "CUSTOMER_CONFIRMATION",
      {
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        cpName: params.cpName,
        companyName: params.companyName || "",
        projectName: params.projectName,
        projectLocation: params.projectLocation,
        acceptUrl: params.acceptUrl,
        rejectUrl: params.rejectUrl,
      },
      {
        subject: `Confirm Channel Partner Association — ${params.projectName}`,
        html: customerConfirmationEmailHtml({
          ...params,
          customerEmail: params.customerEmail,
        }),
      },
    );
    return this.deliverEmail({
      to: params.customerEmail,
      subject: email.subject,
      html: email.html,
      type: "CUSTOMER_CONFIRMATION",
      entityType: "Lead",
      entityId: params.entityId,
    });
  }

  static async notifyLeadOnlyAccepted(params: {
    customerEmail: string;
    customerName: string;
    cpName: string;
    projectName: string;
    projectLocation: string;
    entityId: string;
  }) {
    const email = await this.resolveEmail(
      "LEAD_ONLY_ACCEPTED",
      {
        customerName: params.customerName,
        cpName: params.cpName,
        projectName: params.projectName,
        projectLocation: params.projectLocation,
      },
      {
        subject: `Interest confirmed — ${params.projectName}`,
        html: leadOnlyAcceptedEmailHtml({
          customerName: params.customerName,
          cpName: params.cpName,
          projectName: params.projectName,
          projectLocation: params.projectLocation,
        }),
      },
    );

    return this.deliverEmail({
      to: params.customerEmail,
      subject: email.subject,
      html: email.html,
      type: "LEAD_ONLY_ACCEPTED",
      entityType: "Lead",
      entityId: params.entityId,
    });
  }

  static async notifyEOIInvitation(params: {
    customerEmail: string;
    customerName: string;
    cpName: string;
    projectName: string;
    projectLocation: string;
    startingPrice: string;
    inviteUrl: string;
    customerLoginUrl?: string;
  }) {
    const customerLoginUrl = params.customerLoginUrl || `${getAppBaseUrl()}/customer/login`;
    const email = await this.resolveEmail(
      "EOI_INVITATION",
      {
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        cpName: params.cpName,
        projectName: params.projectName,
        projectLocation: params.projectLocation,
        startingPrice: params.startingPrice,
        inviteUrl: params.inviteUrl,
        customerLoginUrl,
      },
      {
        subject: `Complete Your EOI — ${params.projectName}`,
        html: invitationEmailHtml({
          ...params,
          customerLoginUrl,
        }),
      },
    );
    return this.deliverEmail({
      to: params.customerEmail,
      subject: email.subject,
      html: email.html,
      type: "EOI_INVITATION",
    });
  }

  static async notifyEOISubmitted(params: {
    adminUserId: string;
    customerName: string;
    projectName: string;
    eoiId: string;
  }) {
    await this.emit({
      userId: params.adminUserId,
      type: "NEW_EOI_SUBMITTED",
      title: "New EOI Submitted",
      body: `${params.customerName} submitted an EOI for ${params.projectName}`,
      entityType: "EOI",
      entityId: params.eoiId,
    });

    if (await isAdminNotificationEnabled("approvalReminders")) {
      await this.emit({
        userId: params.adminUserId,
        type: "APPROVAL_PENDING",
        title: "EOI Pending Approval",
        body: `${params.customerName}'s EOI for ${params.projectName} is awaiting your review.`,
        entityType: "EOI",
        entityId: params.eoiId,
      });
    }
  }

  static async notifyCustomerEOISubmitted(params: {
    customerUserId: string;
    customerEmail: string;
    customerName: string;
    projectName: string;
    referenceNumber: string;
  }) {
    const customerPortalUrl = `${getAppBaseUrl()}/customer`;
    const email = await this.resolveEmail(
      "EOI_SUBMITTED",
      {
        customerName: params.customerName,
        projectName: params.projectName,
        referenceNumber: params.referenceNumber,
        customerPortalUrl,
      },
      {
        subject: `EOI Submitted — ${params.projectName}`,
        html: eoiSubmittedEmailHtml({
          customerName: params.customerName,
          projectName: params.projectName,
          referenceNumber: params.referenceNumber,
          customerPortalUrl,
        }),
      },
    );
    await this.emit({
      userId: params.customerUserId,
      type: "NEW_EOI_SUBMITTED",
      title: "EOI Submitted",
      body: `Your EOI for ${params.projectName} has been submitted. Reference: ${params.referenceNumber}`,
      email: {
        to: params.customerEmail,
        subject: email.subject,
        html: email.html,
      },
      emailType: "EOI_SUBMITTED",
    });
  }

  static async notifyCPCustomerSubmitted(params: {
    cpUserId: string;
    cpEmail: string;
    cpName: string;
    customerName: string;
    projectName: string;
    referenceNumber: string;
    eoiId: string;
  }) {
    const resolved = await this.resolveEmail(
      "CUSTOMER_SUBMITTED_EOI",
      {
        cpName: params.cpName,
        customerName: params.customerName,
        projectName: params.projectName,
        referenceNumber: params.referenceNumber,
      },
      {
        subject: `Customer EOI Submitted — ${params.projectName}`,
        html: cpCustomerSubmittedEmailHtml({
          cpName: params.cpName,
          customerName: params.customerName,
          projectName: params.projectName,
          referenceNumber: params.referenceNumber,
        }),
      },
    );
    await this.emit({
      userId: params.cpUserId,
      type: "CUSTOMER_SUBMITTED_EOI",
      title: "Customer Submitted EOI",
      body: `${params.customerName} submitted EOI for ${params.projectName}. Ref: ${params.referenceNumber}`,
      entityType: "EOI",
      entityId: params.eoiId,
      email: {
        to: params.cpEmail,
        subject: resolved.subject,
        html: resolved.html,
      },
      emailType: "CUSTOMER_SUBMITTED_EOI",
    });
  }

  static async notifyCPCustomerRejected(params: {
    cpUserId: string;
    cpEmail: string;
    cpName: string;
    customerName: string;
    projectName: string;
    leadId?: string;
  }) {
    const resolved = await this.resolveEmail(
      "CUSTOMER_REJECTED_CP",
      {
        cpName: params.cpName,
        customerName: params.customerName,
        projectName: params.projectName,
      },
      {
        subject: `Customer Declined Association — ${params.projectName}`,
        html: cpCustomerRejectedEmailHtml({
          cpName: params.cpName,
          customerName: params.customerName,
          projectName: params.projectName,
        }),
      },
    );
    await this.emit({
      userId: params.cpUserId,
      type: "CUSTOMER_REJECTED_CP",
      title: "Customer Rejected Association",
      body: `${params.customerName} rejected association for ${params.projectName}`,
      entityType: "Lead",
      entityId: params.leadId,
      email: {
        to: params.cpEmail,
        subject: resolved.subject,
        html: resolved.html,
      },
      emailType: "CUSTOMER_REJECTED_CP",
    });
  }

  static async notifyEOIApproved(params: {
    customerUserId: string;
    customerEmail: string;
    customerName: string;
    projectName: string;
    confirmationNumber: string;
    cpUserId?: string;
  }) {
    const customerPortalUrl = `${getAppBaseUrl()}/customer`;
    const email = await this.resolveEmail(
      "EOI_APPROVED",
      {
        customerName: params.customerName,
        projectName: params.projectName,
        confirmationNumber: params.confirmationNumber,
        customerPortalUrl,
      },
      {
        subject: `EOI Approved — ${params.projectName}`,
        html: eoiApprovedEmailHtml({ ...params, customerPortalUrl }),
      },
    );
    await this.emit({
      userId: params.customerUserId,
      type: "EOI_APPROVED",
      title: "EOI Approved",
      body: `Your EOI for ${params.projectName} has been approved.`,
      email: {
        to: params.customerEmail,
        subject: email.subject,
        html: email.html,
      },
    });
    if (params.cpUserId) {
      await this.emit({
        userId: params.cpUserId,
        type: "EOI_APPROVED",
        title: "Customer EOI Approved",
        body: `${params.customerName}'s EOI for ${params.projectName} was approved.`,
      });
    }
  }

  static async notifyEOIRejected(params: {
    customerUserId: string;
    customerEmail: string;
    customerName: string;
    projectName: string;
    reason: string;
    remarks?: string;
    cpUserId?: string;
  }) {
    const customerPortalUrl = `${getAppBaseUrl()}/customer`;
    const email = await this.resolveEmail(
      "EOI_REJECTED",
      {
        customerName: params.customerName,
        projectName: params.projectName,
        reason: params.reason,
        remarks: params.remarks || "",
        customerPortalUrl,
      },
      {
        subject: `EOI Update — ${params.projectName}`,
        html: eoiRejectedEmailHtml({ ...params, customerPortalUrl }),
      },
    );
    await this.emit({
      userId: params.customerUserId,
      type: "EOI_REJECTED",
      title: "EOI Rejected",
      body: `Your EOI for ${params.projectName} was rejected.`,
      email: {
        to: params.customerEmail,
        subject: email.subject,
        html: email.html,
      },
    });
    if (params.cpUserId) {
      await this.emit({
        userId: params.cpUserId,
        type: "EOI_REJECTED",
        title: "Customer EOI Rejected",
        body: `${params.customerName}'s EOI for ${params.projectName} was rejected.`,
      });
    }
  }

  static async notifyCorrectionRequested(params: {
    customerUserId: string;
    customerEmail: string;
    customerName: string;
    projectName: string;
    remarks: string;
  }) {
    const eoiFormUrl = `${getAppBaseUrl()}/customer/eoi`;
    const email = await this.resolveEmail(
      "CORRECTION_REQUESTED",
      {
        customerName: params.customerName,
        projectName: params.projectName,
        remarks: params.remarks,
        eoiFormUrl,
      },
      {
        subject: `Action Required — ${params.projectName}`,
        html: correctionRequestedEmailHtml({
          customerName: params.customerName,
          projectName: params.projectName,
          remarks: params.remarks,
          eoiFormUrl,
        }),
      },
    );
    await this.emit({
      userId: params.customerUserId,
      type: "CORRECTION_REQUESTED",
      title: "Correction Requested",
      body: `Corrections needed for your EOI at ${params.projectName}`,
      email: {
        to: params.customerEmail,
        subject: email.subject,
        html: email.html,
      },
    });
  }

  static async notifyProjectStatusUpdated(params: {
    cpUserId: string;
    projectName: string;
    changeSummary: string;
    projectId: string;
  }) {
    await this.emit({
      userId: params.cpUserId,
      type: "PROJECT_STATUS_UPDATED",
      title: "Project Update",
      body: `${params.projectName}: ${params.changeSummary}`,
      entityType: "Project",
      entityId: params.projectId,
    });
  }

  static async notifyCPRegistered(params: {
    adminUserId: string;
    cpName: string;
    companyName?: string;
  }) {
    const supportEmail = await getSupportEmail();
    const email = await this.resolveEmail(
      "CP_REGISTERED",
      { cpName: params.cpName, companyName: params.companyName || "" },
      {
        subject: "New CP Registration — Goyal Projects",
        html: cpRegisteredEmailHtml(params),
      },
    );
    await this.emit({
      userId: params.adminUserId,
      type: "CP_REGISTERED",
      title: "New Channel Partner Registration",
      body: `${params.cpName} has registered and awaits approval`,
      email: {
        to: supportEmail,
        subject: email.subject,
        html: email.html,
      },
    });
  }
}
