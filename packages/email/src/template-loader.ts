import { prisma } from "@goyal/db";
import { getEmailLogoUrl } from "./email-layout";

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

export async function resolveEmailTemplate(
  type: string,
  vars: Record<string, string>,
  fallback: { subject: string; html: string },
): Promise<{ subject: string; html: string }> {
  const template = await prisma.emailTemplate.findUnique({ where: { type } });
  if (!template) {
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
