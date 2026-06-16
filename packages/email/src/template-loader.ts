import { prisma } from "@goyal/db";

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
      <p style="color: #64748B; font-size: 13px; margin: 12px 0 4px;">${label}:</p>
      <p style="margin: 0 0 12px;">
        <a href="${url}" style="color: #2563EB; word-break: break-all;">${url}</a>
      </p>
    `);
  }

  if (missingLinks.length === 0) return result;

  result += `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0;">
      <p style="color: #1A2332; font-weight: 600; font-size: 14px; margin: 0 0 8px;">Your links</p>
      ${missingLinks.join("")}
    </div>
  `;

  return result;
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

  return { subject, html };
}
