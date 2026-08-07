const GOLD = "#C9A84C";
const NAVY = "#1A2332";
const MUTED = "#64748B";
const LIGHT_BG = "#F8F9FB";
const BORDER = "#E8ECF1";

export function getEmailLogoUrl(): string {
  return (
    process.env.EMAIL_LOGO_URL?.trim()
    || "https://raw.githubusercontent.com/Goyal-co/EOI/main/apps/web/public/new_logo.jpeg"
  );
}

export function emailShell(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Goyal & Co. | Hariyana Group</title>
</head>
<body style="margin:0;padding:0;background:#ECEFF3;font-family:'Segoe UI',Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECEFF3;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,35,50,0.06);">
          ${body}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailHeader(stepLabel?: string): string {
  const logoUrl = getEmailLogoUrl();
  const stepBlock = stepLabel
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:4px;background:#ffffff;">
              <tr>
                <td style="padding:8px 16px;font-size:11px;font-weight:600;letter-spacing:0.06em;color:${NAVY};text-transform:uppercase;">
                  ${stepLabel}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : "";

  return `
    <tr>
      <td style="padding:28px 32px 20px;text-align:center;background:#ffffff;border-bottom:1px solid ${BORDER};">
        <img src="${logoUrl}" alt="Goyal & Co. | Hariyana Group" width="280" style="max-width:280px;width:100%;height:auto;display:block;margin:0 auto;" />
        <p style="margin:12px 0 0;font-size:11px;letter-spacing:0.04em;color:${MUTED};">Goyal &amp; Co. | Hariyana Group</p>
        ${stepBlock}
      </td>
    </tr>`;
}

export function emailHero(
  title: string,
  highlight?: string,
  icon?: "check" | "info" | "warning",
): string {
  const statusLabel =
    icon === "check"
      ? highlight || "Confirmed"
      : icon === "warning"
        ? highlight || "Action required"
        : icon === "info"
          ? highlight || "Update"
          : highlight;

  const statusColor =
    icon === "warning" ? "#92400E" : icon === "check" ? "#166534" : NAVY;
  const statusBg =
    icon === "warning" ? "#FFFBEB" : icon === "check" ? "#ECFDF5" : LIGHT_BG;
  const statusBorder =
    icon === "warning" ? "#FDE68A" : icon === "check" ? "#A7F3D0" : BORDER;

  const statusBadge = statusLabel
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
         <tr>
           <td style="padding:6px 12px;border-radius:4px;background:${statusBg};border:1px solid ${statusBorder};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${statusColor};">
             ${statusLabel}
           </td>
         </tr>
       </table>`
    : "";

  return `
    <tr>
      <td style="padding:28px 32px 0;text-align:center;">
        ${statusBadge}
        <h1 style="margin:0;font-size:24px;line-height:1.35;color:${NAVY};font-weight:700;">${title}</h1>
        <div style="width:48px;height:2px;background:${GOLD};margin:16px auto 0;"></div>
      </td>
    </tr>`;
}

export function emailBody(content: string): string {
  return `
    <tr>
      <td style="padding:24px 32px 8px;color:${NAVY};font-size:15px;line-height:1.7;">
        ${content}
      </td>
    </tr>`;
}

export function projectCard(params: {
  projectName: string;
  projectLocation: string;
  startingPrice?: string;
}): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:${LIGHT_BG};border:1px solid ${BORDER};border-radius:8px;">
      <tr>
        <td style="padding:18px 20px;border-left:3px solid ${GOLD};">
          <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Project</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:${NAVY};">${params.projectName}</p>
          <p style="margin:6px 0 0;font-size:14px;color:${MUTED};">${params.projectLocation}</p>
          ${
            params.startingPrice
              ? `<p style="margin:10px 0 0;font-size:14px;font-weight:600;color:${NAVY};">Starting ${params.startingPrice}</p>`
              : ""
          }
        </td>
      </tr>
    </table>`;
}

/** Professional label / value rows — no icons. */
export function detailsGrid(items: { label: string; value: string; icon?: string }[]): string {
  if (!items.length) return "";
  const rows = items
    .map(
      (item, index) => `
    <tr>
      <td style="padding:12px 16px;width:38%;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};border-top:${
        index === 0 ? "0" : `1px solid ${BORDER}`
      };vertical-align:top;">${item.label}</td>
      <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${NAVY};border-top:${
        index === 0 ? "0" : `1px solid ${BORDER}`
      };vertical-align:top;">${item.value}</td>
    </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;">
      ${rows}
    </table>`;
}

export function numberedSteps(steps: string[]): string {
  const rows = steps.map((step, i) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:28px;vertical-align:top;">
              <div style="width:24px;height:24px;border-radius:4px;background:${LIGHT_BG};border:1px solid ${BORDER};color:${NAVY};font-size:12px;font-weight:700;line-height:22px;text-align:center;">${i + 1}</div>
            </td>
            <td style="padding-left:12px;font-size:14px;line-height:1.6;color:${MUTED};">${step}</td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows}
    </table>`;
}

export function primaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
      <tr>
        <td align="center" style="border-radius:6px;background:${GOLD};">
          <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.02em;">${label}</a>
        </td>
      </tr>
    </table>`;
}

export function secondaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 24px;">
      <tr>
        <td align="center" style="border-radius:6px;border:1px solid ${NAVY};">
          <a href="${href}" style="display:inline-block;padding:12px 24px;color:${NAVY};text-decoration:none;font-size:14px;font-weight:600;">${label}</a>
        </td>
      </tr>
    </table>`;
}

export function buttonRow(buttons: { label: string; href: string; variant?: "primary" | "secondary" }[]): string {
  const cells = buttons.map((b) => {
    const isPrimary = b.variant !== "secondary";
    return `
      <td style="padding:4px;">
        <a href="${b.href}" style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;${
          isPrimary
            ? `background:${GOLD};color:#ffffff;`
            : `background:#ffffff;color:${NAVY};border:1px solid ${NAVY};`
        }">${b.label}</a>
      </td>`;
  }).join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;">
      <tr>${cells}</tr>
    </table>`;
}

export function infoBox(content: string, variant: "default" | "warning" = "default"): string {
  const bg = variant === "warning" ? "#FFFBEB" : LIGHT_BG;
  const border = variant === "warning" ? "#FDE68A" : BORDER;
  const color = variant === "warning" ? "#92400E" : NAVY;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${bg};border:1px solid ${border};border-radius:8px;">
      <tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:${color};">${content}</td></tr>
    </table>`;
}

export function emailSupportBlock(): string {
  return `
    <tr>
      <td style="padding:8px 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border:1px solid ${BORDER};border-radius:8px;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${NAVY};">Need assistance?</p>
              <p style="margin:0 0 12px;font-size:13px;color:${MUTED};line-height:1.5;">Our relationship team is available to help.</p>
              <p style="margin:0 0 4px;font-size:13px;color:${NAVY};">Phone: +91 80888 66000 | +91 80888 33000</p>
              <p style="margin:0;font-size:13px;color:${NAVY};">Email: <a href="mailto:info.bng@goyalco.com" style="color:${NAVY};text-decoration:underline;">info.bng@goyalco.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function emailFooter(): string {
  return `
    <tr>
      <td style="padding:0 32px 28px;text-align:center;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};">
          <tr>
            <td style="padding-top:18px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${NAVY};">Goyal &amp; Co. | Hariyana Group</p>
              <p style="margin:0;font-size:12px;color:${MUTED};">Building Trust. Creating Landmarks.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function wrapEmail(parts: string[]): string {
  return emailShell(parts.join(""));
}
