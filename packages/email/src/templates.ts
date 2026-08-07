import { getAppBaseUrl } from "./urls";
import {
  wrapEmail,
  emailHeader,
  emailHero,
  emailBody,
  projectCard,
  detailsGrid,
  numberedSteps,
  primaryButton,
  buttonRow,
  infoBox,
  emailSupportBlock,
  emailFooter,
} from "./email-layout";

const NAVY = "#1A2332";
const GOLD = "#C9A84C";
const MUTED = "#64748B";

function formatApprovalDate(date?: string | Date): string {
  if (!date) {
    return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function cpRegistrationAckEmailHtml(params: { cpName: string; email: string }) {
  return wrapEmail([
    emailHeader(),
    emailHero("Registration Received", "Received", "info"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.cpName}</strong>,</p>
      <p style="margin:0 0 12px;color:${MUTED};">Thank you for registering as a Channel Partner with Goyal & Co. | Hariyana Group.</p>
      <p style="margin:0;color:${MUTED};">Your account (<strong style="color:${NAVY};">${params.email}</strong>) is pending admin approval. You will receive login credentials once approved.</p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function cpCredentialsEmailHtml(params: { cpName: string; email: string; loginUrl: string }) {
  return wrapEmail([
    emailHeader(),
    emailHero("Account Approved", "Approved", "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.cpName}</strong>,</p>
      <p style="margin:0 0 12px;color:${MUTED};">Your Channel Partner account has been approved.</p>
      <p style="margin:0 0 4px;color:${MUTED};"><strong style="color:${NAVY};">Login Email:</strong> ${params.email}</p>
      <p style="margin:0;color:${MUTED};">Use the password you set during registration.</p>
      <div style="text-align:center;">${primaryButton("Go to Partner Dashboard", params.loginUrl)}</div>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function customerConfirmationSubject(params: {
  projectName: string;
  intentType?: string;
}): string {
  return params.intentType === "LEAD_ONLY"
    ? `Confirm Your Lead Registration — ${params.projectName}`
    : `Confirm Your EOI with Channel Partner — ${params.projectName}`;
}

export function customerConfirmationEmailHtml(params: {
  customerName: string;
  customerEmail?: string;
  cpName: string;
  companyName?: string;
  projectName: string;
  projectLocation: string;
  acceptUrl: string;
  rejectUrl: string;
  leadId?: string;
  intentType?: string;
}) {
  const isLeadOnly = params.intentType === "LEAD_ONLY";

  const emailNote = params.customerEmail
    ? isLeadOnly
      ? `<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">This request was sent to <strong style="color:${NAVY};">${params.customerEmail}</strong>.</p>`
      : `<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">This request was sent to <strong style="color:${NAVY};">${params.customerEmail}</strong>. It will also be your Customer Portal login ID.</p>`
    : "";

  const leadDetails = params.leadId
    ? detailsGrid([{ label: "Lead ID", value: params.leadId, icon: "&#128196;" }])
    : "";

  const intro = isLeadOnly
    ? `<strong style="color:${NAVY};">${params.cpName}</strong>${params.companyName ? ` (${params.companyName})` : ""} has punched a <strong style="color:${NAVY};">Lead</strong> for you on:`
    : `<strong style="color:${NAVY};">${params.cpName}</strong>${params.companyName ? ` (${params.companyName})` : ""} would like to assist you with an <strong style="color:${NAVY};">Expression of Interest (EOI)</strong> at:`;

  const summary = isLeadOnly
    ? "This is a lead registration only — not an EOI. Please confirm that this Channel Partner may represent your interest in this project. After you accept, we will email a thank-you confirmation (no portal login is required for a lead)."
    : "Please confirm that you want to proceed with this Channel Partner for an EOI on this project. After you accept, we will email your Customer Portal login ID and password so you can complete the EOI form.";

  const steps = isLeadOnly
    ? [
        "Click <strong>Accept</strong> to confirm this lead registration.",
        "You will receive a thank-you email confirming your interest.",
        "Your Channel Partner will contact you with next steps — no portal login is required.",
      ]
    : [
        "Click <strong>Accept</strong> to confirm your Channel Partner for this EOI.",
        "Check your inbox for your Customer Portal login ID and temporary password.",
        "Sign in to complete your Expression of Interest form for this project.",
      ];

  const closingNote = isLeadOnly
    ? `<p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">This email confirms lead interest only. It is not an Expression of Interest (EOI). If you did not expect this message, decline or ignore it.</p>`
    : `<p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">If you did not expect this EOI confirmation request, you can safely decline or ignore it.</p>`;

  return wrapEmail([
    emailHeader(
      isLeadOnly
        ? "Lead Registration &nbsp;|&nbsp; Confirm Interest"
        : "Expression of Interest &nbsp;|&nbsp; Step 1 of 3",
    ),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong style="color:${GOLD};">${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">${intro}</p>
      ${projectCard({ projectName: params.projectName, projectLocation: params.projectLocation })}
      ${leadDetails}
      ${emailNote}
      <p style="margin:0 0 8px;color:${MUTED};">${summary}</p>
      ${numberedSteps(steps)}
      ${buttonRow([
        { label: isLeadOnly ? "Accept Lead" : "Accept & Continue to EOI", href: params.acceptUrl, variant: "primary" },
        { label: "Decline", href: params.rejectUrl, variant: "secondary" },
      ])}
      ${closingNote}
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function invitationEmailHtml(params: {
  customerName: string;
  customerEmail: string;
  cpName: string;
  projectName: string;
  projectLocation: string;
  startingPrice: string;
  inviteUrl?: string;
  customerLoginUrl?: string;
  leadId?: string;
  password?: string;
}) {
  const loginUrl = params.customerLoginUrl || `${getAppBaseUrl()}/customer/login`;

  const detailItems: { label: string; value: string; icon?: string }[] = [];
  if (params.leadId) {
    detailItems.push({ label: "Lead ID", value: params.leadId, icon: "&#128196;" });
  }
  detailItems.push({ label: "Email", value: params.customerEmail, icon: "&#9993;" });
  if (params.password) {
    detailItems.push({ label: "Temporary Password", value: params.password, icon: "&#128274;" });
  }

  return wrapEmail([
    emailHeader("Expression of Interest &nbsp;|&nbsp; Step 2 of 3"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">
        Thank you for confirming your association with <strong style="color:${NAVY};">${params.cpName}</strong>.
        You can now sign in to the Customer Portal to complete your Expression of Interest for:
      </p>
      ${projectCard({
        projectName: params.projectName,
        projectLocation: params.projectLocation,
        startingPrice: params.startingPrice,
      })}
      ${detailsGrid(detailItems)}
      <div style="text-align:center;">${primaryButton("Go to Customer Login", loginUrl)}</div>
      <p style="margin:16px 0 0;font-size:14px;color:${MUTED};text-align:center;">
        ${params.password
          ? "Use the temporary password above for your first login."
          : "Use your existing customer password."}
        You can reset it from the login page if needed.
      </p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function eoiSubmittedEmailHtml(params: {
  customerName: string;
  projectName: string;
  referenceNumber: string;
  customerPortalUrl?: string;
}) {
  const portalUrl = params.customerPortalUrl || `${getAppBaseUrl()}/customer`;

  return wrapEmail([
    emailHeader(),
    emailHero("EOI Submitted", "Submitted", "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0 0 16px;color:${MUTED};">Your Expression of Interest for <strong style="color:${NAVY};">${params.projectName}</strong> has been submitted successfully.</p>
      ${detailsGrid([
        { label: "Project", value: params.projectName, icon: "&#127970;" },
        { label: "Reference Number", value: params.referenceNumber, icon: "&#128196;" },
        { label: "Status", value: "Pending Review", icon: "&#9203;" },
      ])}
      <p style="margin:0;color:${MUTED};">We will notify you once your EOI is reviewed by our team.</p>
      <div style="text-align:center;">${primaryButton("View My EOI Status", portalUrl)}</div>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function eoiApprovedEmailHtml(params: {
  customerName: string;
  projectName: string;
  confirmationNumber: string;
  approvedDate?: string;
  customerPortalUrl?: string;
}) {
  const portalUrl = params.customerPortalUrl || `${getAppBaseUrl()}/customer`;
  const approvedOn = formatApprovalDate(params.approvedDate);

  return wrapEmail([
    emailHeader(),
    emailHero("EOI Approved", "Approved", "check"),
    emailBody(`
      <p style="margin:0 0 12px;text-align:center;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0 0 16px;text-align:center;color:${MUTED};">
        Congratulations! Your EOI for <strong style="color:${GOLD};">${params.projectName}</strong> has been approved.
      </p>
      ${detailsGrid([
        { label: "Project", value: params.projectName, icon: "&#127970;" },
        { label: "Confirmation Number", value: params.confirmationNumber, icon: "&#128196;" },
        { label: "Approved On", value: approvedOn, icon: "&#128197;" },
      ])}
      <p style="margin:0;text-align:center;color:${MUTED};">You can login to the customer portal to view your EOI details and track next steps.</p>
      <div style="text-align:center;">${primaryButton("View Confirmation", portalUrl)}</div>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function eoiRejectedEmailHtml(params: {
  customerName: string;
  projectName: string;
  reason: string;
  remarks?: string;
  customerPortalUrl?: string;
}) {
  const portalUrl = params.customerPortalUrl || `${getAppBaseUrl()}/customer`;

  return wrapEmail([
    emailHeader(),
    emailHero("EOI Update", undefined, "warning"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0 0 16px;color:${MUTED};">Your EOI for <strong style="color:${NAVY};">${params.projectName}</strong> was not approved.</p>
      ${infoBox(`<strong>Reason:</strong> ${params.reason}${params.remarks ? `<br/><br/><strong>Remarks:</strong> ${params.remarks}` : ""}`, "warning")}
      <div style="text-align:center;">${primaryButton("View Details", portalUrl)}</div>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function correctionRequestedEmailHtml(params: {
  customerName: string;
  projectName: string;
  remarks: string;
  eoiFormUrl?: string;
}) {
  const formUrl = params.eoiFormUrl || `${getAppBaseUrl()}/customer/eoi`;

  return wrapEmail([
    emailHeader(),
    emailHero("Action Required", "Required", "warning"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0 0 16px;color:${MUTED};">Corrections are needed for your EOI at <strong style="color:${NAVY};">${params.projectName}</strong> before it can be approved.</p>
      ${infoBox(params.remarks, "warning")}
      <p style="margin:0;color:${MUTED};">Please sign in and update your EOI form with the requested corrections.</p>
      <div style="text-align:center;">${primaryButton("Update My EOI Form", formUrl)}</div>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function cpRegisteredEmailHtml(params: { cpName: string; companyName?: string }) {
  return wrapEmail([
    emailHeader(),
    emailHero("New CP Registration", "Registration", "info"),
    emailBody(`
      <p style="margin:0;color:${MUTED};">
        <strong style="color:${NAVY};">${params.cpName}</strong>${params.companyName ? ` from ${params.companyName}` : ""} has registered and awaits approval.
      </p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function cpCustomerSubmittedEmailHtml(params: {
  cpName: string;
  customerName: string;
  projectName: string;
  referenceNumber: string;
}) {
  return wrapEmail([
    emailHeader(),
    emailHero("Customer EOI Submitted", "Submitted", "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.cpName}</strong>,</p>
      <p style="margin:0 0 16px;color:${MUTED};"><strong style="color:${NAVY};">${params.customerName}</strong> submitted an EOI for ${params.projectName}.</p>
      ${detailsGrid([
        { label: "Project", value: params.projectName, icon: "&#127970;" },
        { label: "Reference", value: params.referenceNumber, icon: "&#128196;" },
        { label: "Status", value: "Submitted", icon: "&#9203;" },
      ])}
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function cpCustomerRejectedEmailHtml(params: {
  cpName: string;
  customerName: string;
  projectName: string;
}) {
  return wrapEmail([
    emailHeader(),
    emailHero("Customer Declined Association", undefined, "warning"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.cpName}</strong>,</p>
      <p style="margin:0 0 12px;color:${MUTED};"><strong style="color:${NAVY};">${params.customerName}</strong> has declined the Channel Partner association for <strong style="color:${NAVY};">${params.projectName}</strong>.</p>
      <p style="margin:0;color:${MUTED};">No further action is required on this lead.</p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function leadOnlyAcceptedEmailHtml(params: {
  customerName: string;
  cpName: string;
  projectName: string;
  projectLocation: string;
  leadId?: string;
}) {
  const detailItems: { label: string; value: string; icon: string }[] = [];
  if (params.leadId) {
    detailItems.push({ label: "Lead ID", value: params.leadId, icon: "&#128196;" });
  }
  const details = detailItems.length ? detailsGrid(detailItems) : "";

  return wrapEmail([
    emailHeader("Thank You"),
    emailHero("Thank You for Confirming", "Confirmed", "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">
        Thank you for confirming your interest in
        <strong style="color:${NAVY};">${params.projectName}</strong>
        with Channel Partner <strong style="color:${NAVY};">${params.cpName}</strong>.
      </p>
      ${projectCard({ projectName: params.projectName, projectLocation: params.projectLocation })}
      ${details}
      <p style="margin:16px 0 0;color:${MUTED};">
        Your Channel Partner has been notified and will contact you with the next steps.
        This confirms a <strong style="color:${NAVY};">lead only</strong> — not an Expression of Interest (EOI).
        No Customer Portal login is required for this lead.
      </p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function cpLeadOnlyAcceptedEmailHtml(params: {
  cpName: string;
  customerName: string;
  projectName: string;
  leadId?: string;
}) {
  const leadLine = params.leadId
    ? `<p style="margin:12px 0 0;color:${MUTED};">Lead ID: <strong style="color:${NAVY};font-family:monospace;">${params.leadId}</strong></p>`
    : "";
  return wrapEmail([
    emailHeader(),
    emailHero("Customer Confirmed Lead", undefined, "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.cpName}</strong>,</p>
      <p style="margin:0 0 12px;color:${MUTED};">
        <strong style="color:${NAVY};">${params.customerName}</strong> has accepted the lead confirmation for
        <strong style="color:${NAVY};">${params.projectName}</strong>.
      </p>
      ${leadLine}
      <p style="margin:16px 0 0;color:${MUTED};">You can follow up with the customer on next steps from your partner portal.</p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function passwordResetEmailHtml(params: {
  resetUrl: string;
  expiresIn?: string;
}) {
  return wrapEmail([
    emailHeader(),
    emailHero("Reset Your Password", "Password", "info"),
    emailBody(`
      <p style="margin:0 0 16px;color:${MUTED};">
        We received a request to reset your portal password. Use the button below to choose a new password.
      </p>
      <div style="text-align:center;">${primaryButton("Reset Password", params.resetUrl)}</div>
      <p style="margin:16px 0 0;font-size:13px;color:${MUTED};text-align:center;">
        This button expires in ${params.expiresIn || "1 hour"}. If you did not request a reset, ignore this email.
      </p>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

export function leadMilestoneEmailHtml(params: {
  recipientName: string;
  customerName: string;
  projectName: string;
  leadId?: string;
  cpName: string;
  companyName?: string;
  salespersonName?: string;
  milestone: "SITE_VISIT_COMPLETED" | "BOOKED";
  portalUrl: string;
  recipientType: "CP" | "CUSTOMER" | "ADMIN";
}) {
  const isBooked = params.milestone === "BOOKED";
  const title = isBooked ? "Booking Confirmed" : "Site Visit Completed";
  const status = isBooked ? "Booked" : "Site Visit Done";
  const cpLabel = params.cpName;
  const companySuffix =
    params.companyName && params.companyName.trim() && params.companyName !== params.cpName
      ? ` (${params.companyName})`
      : "";
  const cpDisplay = `${cpLabel}${companySuffix}`;

  let message: string;
  if (params.recipientType === "CP") {
    message = isBooked
      ? `Regarding your lead <strong style="color:${NAVY};">${params.customerName}</strong>: their booking for ${params.projectName} has been confirmed with you (${cpDisplay}). The lead is now marked as Booked in your Partner Portal.`
      : `Regarding your lead <strong style="color:${NAVY};">${params.customerName}</strong>: their site visit for ${params.projectName} has been completed with you (${cpDisplay}). The lead is now marked as Site Visit Done in your Partner Portal.`;
  } else if (params.recipientType === "ADMIN") {
    message = isBooked
      ? `${params.customerName} has been marked Booked for ${params.projectName} with Channel Partner ${cpDisplay}.`
      : `${params.customerName} completed a site visit for ${params.projectName} with Channel Partner ${cpDisplay}.`;
  } else {
    message = isBooked
      ? `Your booking for ${params.projectName} with Channel Partner <strong style="color:${NAVY};">${cpDisplay}</strong> has been confirmed.`
      : `Your site visit for ${params.projectName} with Channel Partner <strong style="color:${NAVY};">${cpDisplay}</strong> has been completed and confirmed.`;
  }

  const details = [
    ...(params.recipientType === "CP" || params.recipientType === "ADMIN"
      ? [{ label: "Customer / Lead", value: params.customerName, icon: "&#128100;" }]
      : []),
    { label: "Project", value: params.projectName, icon: "&#127970;" },
    { label: "Channel Partner", value: cpDisplay, icon: "&#128100;" },
    ...(params.salespersonName && params.salespersonName.trim()
      ? [{ label: "Salesperson", value: params.salespersonName, icon: "&#128188;" }]
      : []),
    ...(params.leadId
      ? [{ label: "Lead ID", value: params.leadId, icon: "&#128196;" }]
      : []),
    { label: "Status", value: status, icon: isBooked ? "&#127881;" : "&#10003;" },
  ];

  const ctaLabel =
    params.recipientType === "CP"
      ? "View Lead Status"
      : params.recipientType === "ADMIN"
        ? "Open Admin Leads"
        : "Open Customer Portal";

  return wrapEmail([
    emailHeader(),
    emailHero(title, isBooked ? "Confirmed" : "Completed", "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.recipientName}</strong>,</p>
      ${
        params.recipientType === "CP"
          ? `<p style="margin:0 0 12px;color:${MUTED};">Lead: <strong style="color:${NAVY};">${params.customerName}</strong></p>`
          : ""
      }
      <p style="margin:0 0 16px;color:${MUTED};">${message}</p>
      ${detailsGrid(details)}
      <div style="text-align:center;">${primaryButton(ctaLabel, params.portalUrl)}</div>
    `),
    emailSupportBlock(),
    emailFooter(),
  ]);
}

/** Placeholder HTML for DB email templates (admin-editable) */
export const DEFAULT_EMAIL_TEMPLATE_SUBJECTS: Record<string, string> = {
  CP_REGISTRATION_ACK: "Registration Received — Goyal & Co. | Hariyana Group",
  CP_APPROVED: "Your CP Account is Approved — Goyal & Co. | Hariyana Group",
  CUSTOMER_CONFIRMATION: "Confirm Your EOI with Channel Partner — {{projectName}}",
  CUSTOMER_CONFIRMATION_LEAD_ONLY: "Confirm Your Lead Registration — {{projectName}}",
  EOI_INVITATION: "Complete Your EOI — {{projectName}}",
  LEAD_ONLY_ACCEPTED: "Thank you for confirming — {{projectName}}",
  LEAD_ONLY_ACCEPTED_CP: "Customer Confirmed Lead — {{customerName}} | {{projectName}}",
  EOI_SUBMITTED: "EOI Submitted — {{projectName}}",
  EOI_APPROVED: "EOI Approved — {{projectName}}",
  EOI_REJECTED: "EOI Update — {{projectName}}",
  CORRECTION_REQUESTED: "Action Required — {{projectName}}",
  CP_REGISTERED: "New CP Registration — Goyal & Co. | Hariyana Group",
  CUSTOMER_SUBMITTED_EOI: "Customer EOI Submitted — {{projectName}}",
  CUSTOMER_REJECTED_CP: "Customer Declined Association — {{projectName}}",
  SITE_VISIT_COMPLETED_CP: "Site Visit Completed — {{customerName}} | {{projectName}} | {{cpName}}",
  SITE_VISIT_COMPLETED_CUSTOMER: "Your Site Visit is Completed — {{projectName}} | {{cpName}}",
  LEAD_BOOKED_CP: "Booking Confirmed — {{customerName}} | {{projectName}} | {{cpName}}",
  LEAD_BOOKED_CUSTOMER: "Your Booking is Confirmed — {{projectName}} | {{cpName}}",
};

export const DEFAULT_EMAIL_TEMPLATE_BODIES: Record<string, string> = {
  CP_REGISTRATION_ACK: cpRegistrationAckEmailHtml({
    cpName: "{{cpName}}",
    email: "{{email}}",
  }),
  CP_APPROVED: cpCredentialsEmailHtml({
    cpName: "{{cpName}}",
    email: "{{email}}",
    loginUrl: "{{loginUrl}}",
  }),
  CUSTOMER_CONFIRMATION: customerConfirmationEmailHtml({
    customerName: "{{customerName}}",
    customerEmail: "{{customerEmail}}",
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
    projectName: "{{projectName}}",
    projectLocation: "{{projectLocation}}",
    acceptUrl: "{{acceptUrl}}",
    rejectUrl: "{{rejectUrl}}",
    leadId: "{{leadId}}",
    intentType: "EOI",
  }),
  CUSTOMER_CONFIRMATION_LEAD_ONLY: customerConfirmationEmailHtml({
    customerName: "{{customerName}}",
    customerEmail: "{{customerEmail}}",
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
    projectName: "{{projectName}}",
    projectLocation: "{{projectLocation}}",
    acceptUrl: "{{acceptUrl}}",
    rejectUrl: "{{rejectUrl}}",
    leadId: "{{leadId}}",
    intentType: "LEAD_ONLY",
  }),
  EOI_INVITATION: invitationEmailHtml({
    customerName: "{{customerName}}",
    customerEmail: "{{customerEmail}}",
    cpName: "{{cpName}}",
    projectName: "{{projectName}}",
    projectLocation: "{{projectLocation}}",
    startingPrice: "{{startingPrice}}",
    customerLoginUrl: "{{customerLoginUrl}}",
    leadId: "{{leadId}}",
    password: "{{password}}",
  }),
  LEAD_ONLY_ACCEPTED: leadOnlyAcceptedEmailHtml({
    customerName: "{{customerName}}",
    cpName: "{{cpName}}",
    projectName: "{{projectName}}",
    projectLocation: "{{projectLocation}}",
    leadId: "{{leadId}}",
  }),
  LEAD_ONLY_ACCEPTED_CP: cpLeadOnlyAcceptedEmailHtml({
    cpName: "{{cpName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    leadId: "{{leadId}}",
  }),
  EOI_SUBMITTED: eoiSubmittedEmailHtml({
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    referenceNumber: "{{referenceNumber}}",
    customerPortalUrl: "{{customerPortalUrl}}",
  }),
  EOI_APPROVED: eoiApprovedEmailHtml({
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    confirmationNumber: "{{confirmationNumber}}",
    approvedDate: "{{approvedDate}}",
    customerPortalUrl: "{{customerPortalUrl}}",
  }),
  EOI_REJECTED: eoiRejectedEmailHtml({
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    reason: "{{reason}}",
    remarks: "{{remarks}}",
    customerPortalUrl: "{{customerPortalUrl}}",
  }),
  CORRECTION_REQUESTED: correctionRequestedEmailHtml({
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    remarks: "{{remarks}}",
    eoiFormUrl: "{{eoiFormUrl}}",
  }),
  CP_REGISTERED: cpRegisteredEmailHtml({
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
  }),
  CUSTOMER_SUBMITTED_EOI: cpCustomerSubmittedEmailHtml({
    cpName: "{{cpName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    referenceNumber: "{{referenceNumber}}",
  }),
  CUSTOMER_REJECTED_CP: cpCustomerRejectedEmailHtml({
    cpName: "{{cpName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
  }),
  SITE_VISIT_COMPLETED_CP: leadMilestoneEmailHtml({
    recipientName: "{{recipientName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    leadId: "{{leadId}}",
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
    salespersonName: "{{salespersonName}}",
    milestone: "SITE_VISIT_COMPLETED",
    portalUrl: "{{portalUrl}}",
    recipientType: "CP",
  }),
  SITE_VISIT_COMPLETED_CUSTOMER: leadMilestoneEmailHtml({
    recipientName: "{{recipientName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    leadId: "{{leadId}}",
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
    salespersonName: "{{salespersonName}}",
    milestone: "SITE_VISIT_COMPLETED",
    portalUrl: "{{portalUrl}}",
    recipientType: "CUSTOMER",
  }),
  LEAD_BOOKED_CP: leadMilestoneEmailHtml({
    recipientName: "{{recipientName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    leadId: "{{leadId}}",
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
    salespersonName: "{{salespersonName}}",
    milestone: "BOOKED",
    portalUrl: "{{portalUrl}}",
    recipientType: "CP",
  }),
  LEAD_BOOKED_CUSTOMER: leadMilestoneEmailHtml({
    recipientName: "{{recipientName}}",
    customerName: "{{customerName}}",
    projectName: "{{projectName}}",
    leadId: "{{leadId}}",
    cpName: "{{cpName}}",
    companyName: "{{companyName}}",
    salespersonName: "{{salespersonName}}",
    milestone: "BOOKED",
    portalUrl: "{{portalUrl}}",
    recipientType: "CUSTOMER",
  }),
};
