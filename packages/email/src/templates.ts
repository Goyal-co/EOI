import { getAppBaseUrl } from "./urls";

const baseStyle = `
  font-family: 'Inter', -apple-system, sans-serif;
  max-width: 600px; margin: 0 auto; background: #ffffff;
`;

const headerStyle = `
  background: linear-gradient(135deg, #1A2332 0%, #2D3A4F 100%);
  padding: 32px; text-align: center;
`;

const buttonStyle = `
  display: inline-block; padding: 12px 32px;
  background: #C9A84C; color: white; text-decoration: none;
  border-radius: 8px; font-weight: 600; margin: 8px 4px;
`;

const rejectButtonStyle = `
  display: inline-block; padding: 12px 32px;
  background: #64748B; color: white; text-decoration: none;
  border-radius: 8px; font-weight: 600; margin: 8px 4px;
`;

function linkFallback(url: string, label: string): string {
  return `
    <p style="color: #64748B; font-size: 13px; margin: 16px 0 4px;">${label}:</p>
    <p style="color: #2563EB; font-size: 13px; word-break: break-all; margin: 0 0 16px;">
      <a href="${url}" style="color: #2563EB;">${url}</a>
    </p>
  `;
}

function stepsBlock(steps: string[]): string {
  return `
    <ol style="color: #64748B; line-height: 1.8; padding-left: 20px; margin: 16px 0;">
      ${steps.map((s) => `<li style="margin-bottom: 6px;">${s}</li>`).join("")}
    </ol>
  `;
}

export function cpRegistrationAckEmailHtml(params: { cpName: string; email: string }) {
  return `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: #C9A84C; margin: 0;">Registration Received</h1></div><div style="${paddingBlock()}"><p>Dear ${params.cpName},</p><p>Thank you for registering as a Channel Partner with Goyal Projects.</p><p>Your account (<strong>${params.email}</strong>) is pending admin approval. You will receive login credentials once approved.</p></div></div>`;
}

export function cpCredentialsEmailHtml(params: { cpName: string; email: string; loginUrl: string }) {
  return `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: #C9A84C; margin: 0;">Account Approved</h1></div><div style="${paddingBlock()}"><p>Dear ${params.cpName},</p><p>Your Channel Partner account has been approved.</p><p><strong>Login Email:</strong> ${params.email}</p><p>Use the password you set during registration.</p><div style="text-align: center; margin: 24px 0;"><a href="${params.loginUrl}" style="${buttonStyle}">Go to Partner Dashboard</a></div>${linkFallback(params.loginUrl, "Partner login link")}</div></div>`;
}

function paddingBlock() {
  return "padding: 32px;";
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
    ? `<p style="color: #64748B; font-size: 14px;">This invitation was sent to <strong style="color: #1A2332;">${params.customerEmail}</strong>. Please use the same email when you sign in later.</p>`
    : "";

  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #C9A84C; margin: 0; font-size: 24px;">Goyal Projects</h1>
        <p style="color: #ffffff; margin: 8px 0 0; opacity: 0.8;">Expression of Interest — Step 1 of 3</p>
      </div>
      <div style="${paddingBlock()}">
        <p style="color: #1A2332; font-size: 16px;">Dear ${params.customerName},</p>
        <p style="color: #64748B; line-height: 1.6;">
          <strong style="color: #1A2332;">${params.cpName}</strong>${params.companyName ? ` (${params.companyName})` : ""} would like to assist you with an Expression of Interest (EOI) at:
        </p>
        <div style="background: #F5F8FF; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="color: #1A2332; margin: 0 0 8px;">${params.projectName}</h2>
          <p style="color: #64748B; margin: 0;">${params.projectLocation}</p>
        </div>
        ${emailNote}
        <p style="color: #64748B; line-height: 1.6;">Please confirm whether you would like to proceed with this Channel Partner. After you accept, you will receive a second email with your personal EOI link.</p>
        ${stepsBlock([
          "Click <strong>Accept</strong> below to confirm your Channel Partner association.",
          "Check your inbox for the EOI invitation email with your project link.",
          "Sign in with Google using the same email address and complete your EOI form.",
        ])}
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.acceptUrl}" style="${buttonStyle}">Accept &amp; Continue</a>
          <a href="${params.rejectUrl}" style="${rejectButtonStyle}">Decline</a>
        </div>
        ${linkFallback(params.acceptUrl, "Accept association link")}
        ${linkFallback(params.rejectUrl, "Decline association link")}
        <p style="color: #94A3B8; font-size: 12px; margin-top: 24px;">If you did not expect this email, you can safely decline or ignore it.</p>
      </div>
    </div>
  `;
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

  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #C9A84C; margin: 0; font-size: 24px;">Goyal Projects</h1>
        <p style="color: #ffffff; margin: 8px 0 0; opacity: 0.8;">Expression of Interest — Step 2 of 3</p>
      </div>
      <div style="${paddingBlock()}">
        <p style="color: #1A2332; font-size: 16px;">Dear ${params.customerName},</p>
        <p style="color: #64748B; line-height: 1.6;">
          Thank you for confirming your association with <strong style="color: #1A2332;">${params.cpName}</strong>.
          You can now complete your Expression of Interest for:
        </p>
        <div style="background: #F5F8FF; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="color: #1A2332; margin: 0 0 8px;">${params.projectName}</h2>
          <p style="color: #64748B; margin: 0;">${params.projectLocation}</p>
          <p style="color: #C9A84C; font-weight: 600; margin: 12px 0 0;">Starting ${params.startingPrice}</p>
        </div>
        <p style="color: #64748B; font-size: 14px;">
          Sign in with Google using <strong style="color: #1A2332;">${params.customerEmail}</strong> — the email your Channel Partner registered for you.
        </p>
        ${stepsBlock([
          "Open your EOI invitation link below.",
          "Click <strong>Continue with Google</strong> and sign in with your registered email.",
          "Complete personal details, address, unit preference, and bank information.",
          "Upload PAN, Aadhaar, and cheque documents, then submit your EOI.",
        ])}
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.inviteUrl}" style="${buttonStyle}">Open My EOI Invitation</a>
        </div>
        ${linkFallback(params.inviteUrl, "Your EOI invitation link")}
        <p style="color: #64748B; font-size: 14px; text-align: center;">Already signed in before?</p>
        <div style="text-align: center; margin: 8px 0 24px;">
          <a href="${loginUrl}" style="${rejectButtonStyle}">Go to Customer Login</a>
        </div>
        ${linkFallback(loginUrl, "Customer login link")}
      </div>
    </div>
  `;
}

export function eoiSubmittedEmailHtml(params: {
  customerName: string;
  projectName: string;
  referenceNumber: string;
  customerPortalUrl?: string;
}) {
  const portalUrl = params.customerPortalUrl || `${getAppBaseUrl()}/customer`;
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}"><h1 style="color: #C9A84C; margin: 0;">EOI Submitted Successfully</h1></div>
      <div style="${paddingBlock()}">
        <p>Dear ${params.customerName},</p>
        <p>Your Expression of Interest for <strong>${params.projectName}</strong> has been submitted successfully.</p>
        <div style="background: #F5F8FF; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0; color: #64748B;">EOI Reference Number</p>
          <p style="margin: 8px 0 0; font-size: 20px; font-weight: 700; color: #1A2332;">${params.referenceNumber}</p>
        </div>
        <p style="color: #64748B;">Status: <strong>Pending Admin Review</strong>. We will notify you once your EOI is reviewed.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${portalUrl}" style="${buttonStyle}">View My EOI Status</a>
        </div>
        ${linkFallback(portalUrl, "Customer portal link")}
      </div>
    </div>
  `;
}

export function eoiApprovedEmailHtml(params: {
  customerName: string;
  projectName: string;
  confirmationNumber: string;
  customerPortalUrl?: string;
}) {
  const portalUrl = params.customerPortalUrl || `${getAppBaseUrl()}/customer`;
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}"><h1 style="color: #C9A84C; margin: 0;">EOI Approved</h1></div>
      <div style="${paddingBlock()}">
        <p>Dear ${params.customerName},</p>
        <p>Congratulations! Your EOI for <strong>${params.projectName}</strong> has been approved.</p>
        <p>Confirmation Number: <strong>${params.confirmationNumber}</strong></p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${portalUrl}" style="${buttonStyle}">View Confirmation</a>
        </div>
        ${linkFallback(portalUrl, "Customer portal link")}
      </div>
    </div>
  `;
}

export function eoiRejectedEmailHtml(params: {
  customerName: string;
  projectName: string;
  reason: string;
  remarks?: string;
  customerPortalUrl?: string;
}) {
  const portalUrl = params.customerPortalUrl || `${getAppBaseUrl()}/customer`;
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}"><h1 style="color: #EF4444; margin: 0;">EOI Update</h1></div>
      <div style="${paddingBlock()}">
        <p>Dear ${params.customerName}, your EOI for <strong>${params.projectName}</strong> was not approved.</p>
        <p><strong>Reason:</strong> ${params.reason}</p>
        ${params.remarks ? `<p><strong>Remarks:</strong> ${params.remarks}</p>` : ""}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${portalUrl}" style="${buttonStyle}">View Details</a>
        </div>
        ${linkFallback(portalUrl, "Customer portal link")}
      </div>
    </div>
  `;
}

export function correctionRequestedEmailHtml(params: {
  customerName: string;
  projectName: string;
  remarks: string;
  eoiFormUrl?: string;
}) {
  const formUrl = params.eoiFormUrl || `${getAppBaseUrl()}/customer/eoi`;
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}"><h1 style="color: #F59E0B; margin: 0;">Action Required — Update Your EOI</h1></div>
      <div style="${paddingBlock()}">
        <p>Dear ${params.customerName},</p>
        <p>Corrections are needed for your EOI at <strong>${params.projectName}</strong> before it can be approved.</p>
        <div style="background: #FFFBEB; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #FDE68A;">
          <p style="margin: 0; color: #92400E;">${params.remarks}</p>
        </div>
        <p style="color: #64748B;">Please sign in and update your EOI form with the requested corrections.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${formUrl}" style="${buttonStyle}">Update My EOI Form</a>
        </div>
        ${linkFallback(formUrl, "EOI form link")}
      </div>
    </div>
  `;
}

export function cpRegisteredEmailHtml(params: { cpName: string; companyName?: string }) {
  return `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: #C9A84C;">New CP Registration</h1></div><div style="${paddingBlock()}"><p>${params.cpName}${params.companyName ? ` from ${params.companyName}` : ""} has registered and awaits approval.</p></div></div>`;
}

export function cpCustomerSubmittedEmailHtml(params: { cpName: string; customerName: string; projectName: string; referenceNumber: string }) {
  return `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: #C9A84C;">Customer EOI Submitted</h1></div><div style="${paddingBlock()}"><p>Dear ${params.cpName},</p><p><strong>${params.customerName}</strong> submitted an EOI for ${params.projectName}.</p><p>Reference: ${params.referenceNumber}</p></div></div>`;
}

export function cpCustomerRejectedEmailHtml(params: { cpName: string; customerName: string; projectName: string }) {
  return `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: #EF4444;">Customer Declined Association</h1></div><div style="${paddingBlock()}"><p>Dear ${params.cpName},</p><p><strong>${params.customerName}</strong> has declined the Channel Partner association for <strong>${params.projectName}</strong>.</p><p>No further action is required on this lead.</p></div></div>`;
}

export function leadOnlyAcceptedEmailHtml(params: {
  customerName: string;
  cpName: string;
  projectName: string;
  projectLocation: string;
}) {
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #C9A84C; margin: 0; font-size: 24px;">Goyal Projects</h1>
        <p style="color: #ffffff; margin: 8px 0 0; opacity: 0.8;">Interest Confirmed</p>
      </div>
      <div style="${paddingBlock()}">
        <p style="color: #1A2332; font-size: 16px;">Dear ${params.customerName},</p>
        <p style="color: #64748B; line-height: 1.6;">
          Thank you for confirming your interest in <strong style="color: #1A2332;">${params.projectName}</strong>
          with Channel Partner <strong style="color: #1A2332;">${params.cpName}</strong>.
        </p>
        <div style="background: #F5F8FF; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="color: #1A2332; margin: 0 0 8px;">${params.projectName}</h2>
          <p style="color: #64748B; margin: 0;">${params.projectLocation}</p>
        </div>
        <p style="color: #64748B; line-height: 1.6;">
          Your interest has been registered. Our team and your Channel Partner will reach out with next steps.
          No further action is required from you at this time.
        </p>
        <p style="color: #94A3B8; font-size: 12px; margin-top: 24px;">
          EOI is currently closed for this project. This confirmation records your interest only.
        </p>
      </div>
    </div>
  `;
}

/** Placeholder HTML for DB email templates (admin-editable) */
export const DEFAULT_EMAIL_TEMPLATE_SUBJECTS: Record<string, string> = {
  CP_REGISTRATION_ACK: "Registration Received — Goyal Projects",
  CP_APPROVED: "Your CP Account is Approved — Goyal Projects",
  CUSTOMER_CONFIRMATION: "Confirm Channel Partner Association — {{projectName}}",
  EOI_INVITATION: "Complete Your EOI — {{projectName}}",
  LEAD_ONLY_ACCEPTED: "Interest confirmed — {{projectName}}",
  EOI_SUBMITTED: "EOI Submitted — {{projectName}}",
  EOI_APPROVED: "EOI Approved — {{projectName}}",
  EOI_REJECTED: "EOI Update — {{projectName}}",
  CORRECTION_REQUESTED: "Action Required — {{projectName}}",
  CP_REGISTERED: "New CP Registration — Goyal Projects",
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
