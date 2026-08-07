import { prisma } from "@goyal/db";
import { getEmailLogoUrl } from "./email-layout";
import {
  DEFAULT_EMAIL_TEMPLATE_BODIES,
  DEFAULT_EMAIL_TEMPLATE_SUBJECTS,
} from "./templates";

const ACTION_LINKS: { key: string; label: string }[] = [
  { key: "acceptUrl", label: "Accept association" },
  { key: "rejectUrl", label: "Decline association" },
  { key: "inviteUrl", label: "Open your EOI invitation" },
  { key: "customerLoginUrl", label: "Customer login" },
  { key: "customerPortalUrl", label: "Customer portal" },
  { key: "eoiFormUrl", label: "Complete or update your EOI form" },
  { key: "loginUrl", label: "Login link" },
];

export function applyTemplatePlaceholders(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value ?? ""),
    template,
  );
}

/** Append any action URLs from vars that are missing from the rendered HTML. */
export function ensureActionLinks(html: string, vars: Record<string, string>): string {
  let result = html;
  const missingLinks: string[] = [];

  for (const { key, label } of ACTION_LINKS) {
    const url = vars[key]?.trim();
    if (!url) continue;
    if (result.includes(url)) continue;

    missingLinks.push(`
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto;">
        <tr>
          <td align="center" style="border-radius:8px;background:#C9A84C;">
            <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${label}</a>
          </td>
        </tr>
      </table>
    `);
  }

  if (missingLinks.length === 0) return result;

  result += `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
      <p style="color: #1A2332; font-weight: 600; font-size: 14px; margin: 0 0 8px; text-align:center;">Actions</p>
      ${missingLinks.join("")}
    </div>
  `;

  return result;
}

/**
 * Saved templates keep whatever logo URL was live when they were stored, which
 * breaks branding after a domain change. Always point logos at the current URL.
 */
export function withCurrentLogo(html: string): string {
  const logoUrl = getEmailLogoUrl();
  return html.replace(/<img\b[^>]*alt="Goyal[^"]*"[^>]*>/gi, (tag) =>
    tag.replace(/src="[^"]*"/i, `src="${logoUrl}"`),
  );
}

/** Detect admin/DB templates that still use EOI copy for lead-only flows (or vice versa). */
export function isMismatchedEmailTemplate(type: string, subject: string, body: string): boolean {
  const text = `${subject}\n${body}`;
  const hasEoiPunchCopy = /Expression of Interest|Step 1 of 3|complete your EOI|Accept &amp; Continue to EOI|Confirm Your EOI/i.test(text);
  const hasLeadPunchCopy = /Lead Registration|Confirm Your Lead|Accept Lead|lead registration only|Lead Confirmed/i.test(text);

  if (type === "CUSTOMER_CONFIRMATION_LEAD_ONLY" || type === "LEAD_ONLY_ACCEPTED" || type === "LEAD_ONLY_ACCEPTED_CP") {
    return hasEoiPunchCopy && !hasLeadPunchCopy;
  }
  if (type === "CUSTOMER_CONFIRMATION" || type === "EOI_INVITATION") {
    return hasLeadPunchCopy && !hasEoiPunchCopy;
  }
  return false;
}

export async function resolveEmailTemplate(
  type: string,
  vars: Record<string, string>,
  fallback: { subject: string; html: string },
): Promise<{ subject: string; html: string }> {
  const template = await prisma.emailTemplate.findUnique({ where: { type } });
  if (!template || isMismatchedEmailTemplate(type, template.subject, template.body)) {
    if (template) {
      console.warn(
        `[Email] Ignoring stale DB template for ${type}; using code fallback`,
      );
    }
    return {
      subject: applyTemplatePlaceholders(fallback.subject, vars),
      html: ensureActionLinks(fallback.html, vars),
    };
  }

  const subject = applyTemplatePlaceholders(template.subject, vars);
  let html = applyTemplatePlaceholders(template.body, vars);

  // Custom admin templates may omit links — always inject missing action URLs.
  html = ensureActionLinks(html, vars);
  html = withCurrentLogo(html);

  return { subject, html };
}

/**
 * Ensure every default template exists in DB. Optionally force-refresh known
 * lead/EOI confirmation templates so production stops sending mixed copy.
 */
export async function syncDefaultEmailTemplates(options?: {
  forceLeadEoiTemplates?: boolean;
}): Promise<{ created: number; updated: number }> {
  const forceTypes = new Set([
    "CUSTOMER_CONFIRMATION",
    "CUSTOMER_CONFIRMATION_LEAD_ONLY",
    "EOI_INVITATION",
    "LEAD_ONLY_ACCEPTED",
    "LEAD_ONLY_ACCEPTED_CP",
  ]);
  let created = 0;
  let updated = 0;

  for (const type of Object.keys(DEFAULT_EMAIL_TEMPLATE_SUBJECTS)) {
    const subject = DEFAULT_EMAIL_TEMPLATE_SUBJECTS[type];
    const body = DEFAULT_EMAIL_TEMPLATE_BODIES[type];
    if (!subject || !body) continue;

    const existing = await prisma.emailTemplate.findUnique({ where: { type } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: { type, subject, body } });
      created += 1;
      continue;
    }

    const shouldForce =
      !!options?.forceLeadEoiTemplates
      && forceTypes.has(type);
    const mismatched = isMismatchedEmailTemplate(type, existing.subject, existing.body);
    if (shouldForce || mismatched) {
      await prisma.emailTemplate.update({
        where: { type },
        data: { subject, body },
      });
      updated += 1;
    }
  }

  return { created, updated };
}
