import { prisma, NotificationType } from "@goyal/db";
import { sendEmailWithLog, processEmailRetryQueue } from "./email-log";
import { shouldSendEmail, shouldCreateInAppNotification, isAdminNotificationEnabled, getSupportEmail } from "./prefs";
import { resolveEmailTemplate } from "./template-loader";
import { getAppBaseUrl } from "./urls";
import {
  cpRegistrationAckEmailHtml,
  cpCredentialsEmailHtml,
  customerConfirmationEmailHtml,
  customerConfirmationSubject,
  invitationEmailHtml,
  eoiSubmittedEmailHtml,
  eoiApprovedEmailHtml,
  eoiRejectedEmailHtml,
  correctionRequestedEmailHtml,
  cpRegisteredEmailHtml,
  cpCustomerSubmittedEmailHtml,
  cpCustomerRejectedEmailHtml,
  leadOnlyAcceptedEmailHtml,
  cpLeadOnlyAcceptedEmailHtml,
  leadMilestoneEmailHtml,
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
        subject: "Registration Received — Goyal & Co. | Hariyana Group",
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
        subject: "Your CP Account is Approved — Goyal & Co. | Hariyana Group",
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
    leadId?: string;
    entityId?: string;
    intentType?: string;
  }) {
    // Only the public Lead ID is customer-facing; never fall back to internal ids.
    const leadId = params.leadId?.trim() || "";
    const isLeadOnly = params.intentType === "LEAD_ONLY";
    const email = await this.resolveEmail(
      isLeadOnly ? "CUSTOMER_CONFIRMATION_LEAD_ONLY" : "CUSTOMER_CONFIRMATION",
      {
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        cpName: params.cpName,
        companyName: params.companyName || "",
        projectName: params.projectName,
        projectLocation: params.projectLocation,
        acceptUrl: params.acceptUrl,
        rejectUrl: params.rejectUrl,
        leadId,
      },
      {
        subject: customerConfirmationSubject({
          projectName: params.projectName,
          intentType: params.intentType,
        }),
        html: customerConfirmationEmailHtml({
          ...params,
          customerEmail: params.customerEmail,
          leadId: leadId || undefined,
        }),
      },
    );
    return this.deliverEmail({
      to: params.customerEmail,
      subject: email.subject,
      html: email.html,
      type: isLeadOnly ? "CUSTOMER_CONFIRMATION_LEAD_ONLY" : "CUSTOMER_CONFIRMATION",
      entityType: "Lead",
      entityId: params.entityId || params.leadId,
    });
  }

  static async notifyLeadOnlyAccepted(params: {
    customerEmail: string;
    customerName: string;
    cpName: string;
    projectName: string;
    projectLocation: string;
    entityId: string;
    leadId?: string;
  }) {
    const leadId = params.leadId || params.entityId;
    const email = await this.resolveEmail(
      "LEAD_ONLY_ACCEPTED",
      {
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        cpName: params.cpName,
        projectName: params.projectName,
        projectLocation: params.projectLocation,
        leadId,
      },
      {
        subject: `Thank you for confirming — ${params.projectName}`,
        html: leadOnlyAcceptedEmailHtml({
          customerName: params.customerName,
          cpName: params.cpName,
          projectName: params.projectName,
          projectLocation: params.projectLocation,
          leadId,
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

  static async notifyCPLeadOnlyAccepted(params: {
    cpUserId: string;
    cpEmail: string;
    cpName: string;
    customerName: string;
    projectName: string;
    leadId?: string;
    entityId: string;
  }) {
    const resolved = await this.resolveEmail(
      "LEAD_ONLY_ACCEPTED_CP",
      {
        cpName: params.cpName,
        customerName: params.customerName,
        projectName: params.projectName,
        leadId: params.leadId || "",
      },
      {
        subject: `Customer Confirmed Lead — ${params.customerName} | ${params.projectName}`,
        html: cpLeadOnlyAcceptedEmailHtml({
          cpName: params.cpName,
          customerName: params.customerName,
          projectName: params.projectName,
          leadId: params.leadId,
        }),
      },
    );
    await this.emit({
      userId: params.cpUserId,
      type: "CUSTOMER_CONFIRMATION",
      title: "Customer Confirmed Lead",
      body: `${params.customerName} confirmed lead interest for ${params.projectName}`,
      entityType: "Lead",
      entityId: params.entityId,
      email: {
        to: params.cpEmail,
        subject: resolved.subject,
        html: resolved.html,
      },
      emailType: "LEAD_ONLY_ACCEPTED_CP",
    });
  }

  static async notifyLeadMilestone(params: {
    milestone: "SITE_VISIT_COMPLETED" | "BOOKED";
    entityId: string;
    leadId?: string;
    customerName: string;
    customerEmail: string;
    customerUserId?: string;
    cpName: string;
    companyName?: string;
    cpEmail: string;
    cpUserId: string;
    projectName: string;
    salespersonName?: string;
  }) {
    const isBooked = params.milestone === "BOOKED";
    const appUrl = getAppBaseUrl();
    const cpPortalUrl = `${appUrl}/partner/leads${
      params.leadId ? `?search=${encodeURIComponent(params.leadId)}` : ""
    }`;
    const customerPortalUrl = `${appUrl}/customer`;
    const adminLeadsUrl = `${appUrl}/admin/leads${
      params.leadId ? `?q=${encodeURIComponent(params.leadId)}` : ""
    }`;
    const cpLabel = params.companyName
      ? `${params.cpName} (${params.companyName})`
      : params.cpName;
    const vars = {
      recipientName: "",
      customerName: params.customerName,
      projectName: params.projectName,
      leadId: params.leadId || "",
      portalUrl: "",
      cpName: params.cpName,
      companyName: params.companyName || "",
      salespersonName: params.salespersonName || "",
    };

    const cpTemplateType = isBooked ? "LEAD_BOOKED_CP" : "SITE_VISIT_COMPLETED_CP";
    const customerTemplateType = isBooked
      ? "LEAD_BOOKED_CUSTOMER"
      : "SITE_VISIT_COMPLETED_CUSTOMER";
    const cpTitle = isBooked ? "Lead Booked" : "Site Visit Completed";
    const cpBody = isBooked
      ? `${params.customerName}'s booking for ${params.projectName} is confirmed (CP: ${cpLabel}).`
      : `${params.customerName}'s site visit for ${params.projectName} is completed (CP: ${cpLabel}).`;
    const customerTitle = isBooked ? "Booking Confirmed" : "Site Visit Completed";
    const customerBody = isBooked
      ? `Your booking for ${params.projectName} with ${cpLabel} is confirmed.`
      : `Your site visit for ${params.projectName} with ${cpLabel} is completed.`;
    const adminTitle = isBooked ? "Lead Booked" : "Site Visit Completed";
    const adminBody = isBooked
      ? `${params.customerName} booked ${params.projectName} with ${cpLabel}.`
      : `${params.customerName} completed site visit for ${params.projectName} with ${cpLabel}.`;

    const milestoneHtml = (recipientName: string, recipientType: "CP" | "CUSTOMER" | "ADMIN", portalUrl: string) =>
      leadMilestoneEmailHtml({
        recipientName,
        customerName: params.customerName,
        projectName: params.projectName,
        leadId: params.leadId,
        cpName: params.cpName,
        companyName: params.companyName,
        salespersonName: params.salespersonName,
        milestone: params.milestone,
        portalUrl,
        recipientType,
      });

    const [cpEmail, customerEmail] = await Promise.all([
      this.resolveEmail(
        cpTemplateType,
        { ...vars, recipientName: params.cpName, portalUrl: cpPortalUrl },
        {
          subject: isBooked
            ? `Booking Confirmed — ${params.customerName} | ${params.projectName} | ${params.cpName}`
            : `Site Visit Completed — ${params.customerName} | ${params.projectName} | ${params.cpName}`,
          html: milestoneHtml(params.cpName, "CP", cpPortalUrl),
        },
      ),
      this.resolveEmail(
        customerTemplateType,
        { ...vars, recipientName: params.customerName, portalUrl: customerPortalUrl },
        {
          subject: isBooked
            ? `Your Booking is Confirmed — ${params.projectName} | ${params.cpName}`
            : `Your Site Visit is Completed — ${params.projectName} | ${params.cpName}`,
          html: milestoneHtml(params.customerName, "CUSTOMER", customerPortalUrl),
        },
      ),
    ]);

    const deliveries: Promise<unknown>[] = [
      this.emit({
        userId: params.cpUserId,
        type: "PROJECT_STATUS_UPDATED",
        title: cpTitle,
        body: cpBody,
        entityType: "Lead",
        entityId: params.entityId,
        emailType: cpTemplateType,
        email: {
          to: params.cpEmail,
          subject: cpEmail.subject,
          html: cpEmail.html,
        },
      }),
    ];

    if (params.customerUserId) {
      deliveries.push(
        this.emit({
          userId: params.customerUserId,
          type: "PROJECT_STATUS_UPDATED",
          title: customerTitle,
          body: customerBody,
          entityType: "Lead",
          entityId: params.entityId,
          emailType: customerTemplateType,
          email: {
            to: params.customerEmail,
            subject: customerEmail.subject,
            html: customerEmail.html,
          },
        }),
      );
    } else if (params.customerEmail) {
      deliveries.push(
        this.deliverEmail({
          to: params.customerEmail,
          subject: customerEmail.subject,
          html: customerEmail.html,
          type: customerTemplateType,
          entityType: "Lead",
          entityId: params.entityId,
        }),
      );
    }

    // In-app + support inbox for admins (history lives in Admin Leads)
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { id: true, email: true, name: true },
        take: 20,
      });
      const supportEmail = await getSupportEmail().catch(() => null);
      for (const admin of admins) {
        deliveries.push(
          this.emit({
            userId: admin.id,
            type: "PROJECT_STATUS_UPDATED",
            title: adminTitle,
            body: adminBody,
            entityType: "Lead",
            entityId: params.entityId,
          }),
        );
      }
      if (supportEmail && (await isAdminNotificationEnabled("projectUpdates").catch(() => true))) {
        deliveries.push(
          this.deliverEmail({
            to: supportEmail,
            subject: isBooked
              ? `Lead Booked — ${params.customerName} | ${params.projectName} | ${params.cpName}`
              : `Site Visit — ${params.customerName} | ${params.projectName} | ${params.cpName}`,
            html: milestoneHtml("Admin", "ADMIN", adminLeadsUrl),
            type: isBooked ? "LEAD_BOOKED_CP" : "SITE_VISIT_COMPLETED_CP",
            entityType: "Lead",
            entityId: params.entityId,
          }),
        );
      }
    } catch (e) {
      console.error("[notifyLeadMilestone] admin notify failed", e);
    }

    return Promise.allSettled(deliveries);
  }

  static async notifyEOIInvitation(params: {
    customerEmail: string;
    customerName: string;
    cpName: string;
    projectName: string;
    projectLocation: string;
    startingPrice: string;
    inviteUrl?: string;
    customerLoginUrl?: string;
    leadId?: string;
    password?: string;
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
        inviteUrl: params.inviteUrl || "",
        customerLoginUrl,
        leadId: params.leadId || "",
        password: params.password || "",
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
      entityType: "Lead",
      entityId: params.leadId,
    });
  }

  /** Send customer portal login credentials (email + temporary password). */
  static async notifyCustomerCredentials(params: {
    customerEmail: string;
    customerName: string;
    cpName: string;
    projectName: string;
    projectLocation: string;
    startingPrice: string;
    password: string;
    leadId?: string;
    customerLoginUrl?: string;
  }) {
    return this.notifyEOIInvitation({
      ...params,
      password: params.password,
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
    approvedDate?: string;
    cpUserId?: string;
  }) {
    const customerPortalUrl = `${getAppBaseUrl()}/customer`;
    const approvedDate = params.approvedDate || new Date().toISOString();
    const email = await this.resolveEmail(
      "EOI_APPROVED",
      {
        customerName: params.customerName,
        projectName: params.projectName,
        confirmationNumber: params.confirmationNumber,
        approvedDate,
        customerPortalUrl,
      },
      {
        subject: `EOI Approved — ${params.projectName}`,
        html: eoiApprovedEmailHtml({ ...params, approvedDate, customerPortalUrl }),
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
        subject: "New CP Registration — Goyal & Co. | Hariyana Group",
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
