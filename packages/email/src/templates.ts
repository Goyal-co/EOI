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
  secondaryButton,
  buttonRow,
  infoBox,
  linkFallback,
  emailSupportBlock,
  emailStatsBlock,
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
    emailStatsBlock(),
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
      ${linkFallback(params.loginUrl, "Partner login link")}
    `),
    emailSupportBlock(),
    emailStatsBlock(),
    emailFooter(),
  ]);
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
}) {
  const emailNote = params.customerEmail
    ? `<p style="margin:16px 0 0;font-size:14px;color:${MUTED};">This invitation was sent to <a href="mailto:${params.customerEmail}" style="color:#2563EB;">${params.customerEmail}</a>. Please use the same email when you sign in later.</p>`
    : "";

  return wrapEmail([
    emailHeader("Expression of Interest &nbsp;|&nbsp; Step 1 of 3"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong style="color:${GOLD};">${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">
        <strong style="color:${NAVY};">${params.cpName}</strong>${params.companyName ? ` (${params.companyName})` : ""} would like to assist you with an Expression of Interest (EOI) at:
      </p>
      ${projectCard({ projectName: params.projectName, projectLocation: params.projectLocation })}
      ${emailNote}
      <p style="margin:0 0 8px;color:${MUTED};">Please confirm whether you would like to proceed with this Channel Partner. After you accept, you will receive a second email with your personal EOI link.</p>
      ${numberedSteps([
        "Click <strong>Accept</strong> below to confirm your Channel Partner association.",
        "Check your inbox for the EOI invitation email with your project link.",
        "Sign in with Google using the same email address and complete your EOI form.",
      ])}
      ${buttonRow([
        { label: "Accept & Continue", href: params.acceptUrl, variant: "primary" },
        { label: "Decline", href: params.rejectUrl, variant: "secondary" },
      ])}
      ${linkFallback(params.acceptUrl, "Accept association link")}
      ${linkFallback(params.rejectUrl, "Decline association link")}
      <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">If you did not expect this email, you can safely decline or ignore it.</p>
    `),
    emailSupportBlock(),
    emailStatsBlock(),
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
  inviteUrl: string;
  customerLoginUrl?: string;
}) {
  const loginUrl = params.customerLoginUrl || `${getAppBaseUrl()}/customer/login`;

  return wrapEmail([
    emailHeader("Expression of Interest &nbsp;|&nbsp; Step 2 of 3"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">
        Thank you for confirming your association with <strong style="color:${NAVY};">${params.cpName}</strong>.
        You can now complete your Expression of Interest for:
      </p>
      ${projectCard({
        projectName: params.projectName,
        projectLocation: params.projectLocation,
        startingPrice: params.startingPrice,
      })}
      <p style="margin:0;font-size:14px;color:${MUTED};">
        Sign in with Google using <strong style="color:${NAVY};">${params.customerEmail}</strong> — the email your Channel Partner registered for you.
      </p>
      ${numberedSteps([
        "Open your EOI invitation link below.",
        "Click <strong>Continue with Google</strong> and sign in with your registered email.",
        "Complete personal details, address, unit preference, and bank information.",
        "Upload PAN, Aadhaar, and cheque documents, then submit your EOI.",
      ])}
      <div style="text-align:center;">${primaryButton("Open My EOI Invitation", params.inviteUrl)}</div>
      ${linkFallback(params.inviteUrl, "Your EOI invitation link")}
      <p style="margin:16px 0 8px;font-size:14px;color:${MUTED};text-align:center;">Already signed in before?</p>
      <div style="text-align:center;">${secondaryButton("Go to Customer Login", loginUrl)}</div>
      ${linkFallback(loginUrl, "Customer login link")}
    `),
    emailSupportBlock(),
    emailStatsBlock(),
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
      ${linkFallback(portalUrl, "Customer portal link")}
    `),
    emailSupportBlock(),
    emailStatsBlock(),
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
      ${linkFallback(portalUrl, "Customer portal link")}
    `),
    emailSupportBlock(),
    emailStatsBlock(),
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
      ${linkFallback(portalUrl, "Customer portal link")}
    `),
    emailSupportBlock(),
    emailStatsBlock(),
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
      ${linkFallback(formUrl, "EOI form link")}
    `),
    emailSupportBlock(),
    emailStatsBlock(),
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
    emailStatsBlock(),
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
    emailStatsBlock(),
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
    emailStatsBlock(),
    emailFooter(),
  ]);
}

export function leadOnlyAcceptedEmailHtml(params: {
  customerName: string;
  cpName: string;
  projectName: string;
  projectLocation: string;
}) {
  return wrapEmail([
    emailHeader("Interest Confirmed"),
    emailHero("Interest Confirmed", "Confirmed", "check"),
    emailBody(`
      <p style="margin:0 0 12px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="margin:0;color:${MUTED};">
        Thank you for confirming your interest in <strong style="color:${NAVY};">${params.projectName}</strong>
        with Channel Partner <strong style="color:${NAVY};">${params.cpName}</strong>.
      </p>
      ${projectCard({ projectName: params.projectName, projectLocation: params.projectLocation })}
      <p style="margin:0;color:${MUTED};">
        Your interest has been registered. Our team and your Channel Partner will reach out with next steps.
        No further action is required from you at this time.
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#94A3B8;">EOI is currently closed for this project. This confirmation records your interest only.</p>
    `),
    emailSupportBlock(),
    emailStatsBlock(),
    emailFooter(),
  ]);
}

/** Placeholder HTML for DB email templates (admin-editable) */
export const DEFAULT_EMAIL_TEMPLATE_SUBJECTS: Record<string, string> = {
  CP_REGISTRATION_ACK: "Registration Received — Goyal & Co. | Hariyana Group",
  CP_APPROVED: "Your CP Account is Approved — Goyal & Co. | Hariyana Group",
  CUSTOMER_CONFIRMATION: "Confirm Channel Partner Association — {{projectName}}",
  EOI_INVITATION: "Complete Your EOI — {{projectName}}",
  LEAD_ONLY_ACCEPTED: "Interest confirmed — {{projectName}}",
  EOI_SUBMITTED: "EOI Submitted — {{projectName}}",
  EOI_APPROVED: "EOI Approved — {{projectName}}",
  EOI_REJECTED: "EOI Update — {{projectName}}",
  CORRECTION_REQUESTED: "Action Required — {{projectName}}",
  CP_REGISTERED: "New CP Registration — Goyal & Co. | Hariyana Group",
  CUSTOMER_SUBMITTED_EOI: "Customer EOI Submitted — {{projectName}}",
  CUSTOMER_REJECTED_CP: "Customer Declined Association — {{projectName}}",
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
  }),
  EOI_INVITATION: invitationEmailHtml({
    customerName: "{{customerName}}",
    customerEmail: "{{customerEmail}}",
    cpName: "{{cpName}}",
    projectName: "{{projectName}}",
    projectLocation: "{{projectLocation}}",
    startingPrice: "{{startingPrice}}",
    inviteUrl: "{{inviteUrl}}",
    customerLoginUrl: "{{customerLoginUrl}}",
  }),
  LEAD_ONLY_ACCEPTED: leadOnlyAcceptedEmailHtml({
    customerName: "{{customerName}}",
    cpName: "{{cpName}}",
    projectName: "{{projectName}}",
    projectLocation: "{{projectLocation}}",
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
};
