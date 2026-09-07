import { rewriteEmailHtmlUrls } from "./urls";
import { logger, redactEmail } from "@goyal/logger";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

function getBrevoApiKey(): string | undefined {
  return process.env.BREVO_API_KEY?.trim();
}

function getSender(): { name: string; email: string } {
  const from = optionsFromEnv();
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "Goyal & Co. | Hariyana Group";

  const bracketMatch = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (bracketMatch) {
    return { name: bracketMatch[1].trim(), email: bracketMatch[2].trim() };
  }

  return { name: fromName, email: from };
}

function optionsFromEnv(): string {
  return process.env.EMAIL_FROM?.trim() || "noreply@goyalprojects.com";
}

export interface EmailSendResult {
  success: boolean;
  id?: string;
  error?: string;
  mocked?: boolean;
}

export function shouldUseMockEmail(): boolean {
  const apiKey = getBrevoApiKey();
  if (!apiKey) return true;
  return /placeholder|your_|example|^xkeysib-dev_/i.test(apiKey);
}

export async function sendEmail(options: EmailOptions): Promise<EmailSendResult> {
  const html = rewriteEmailHtmlUrls(options.html);
  const sender = getSender();
  const fromOverride = options.from?.trim();
  const resolvedSender = fromOverride
    ? (() => {
        const match = fromOverride.match(/^(.+?)\s*<([^>]+)>$/);
        return match
          ? { name: match[1].trim(), email: match[2].trim() }
          : { name: sender.name, email: fromOverride };
      })()
    : sender;

  if (shouldUseMockEmail()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BREVO_API_KEY is required in production");
    }
    logger.warn("email.send", "MOCK MODE — BREVO_API_KEY not loaded", {
      to: redactEmail(options.to),
      subject: options.subject,
    });
    return { success: true, id: `mock-${Date.now()}`, mocked: true };
  }

  const apiKey = getBrevoApiKey()!;
  logger.debug("email.send", "Sending via Brevo", { to: redactEmail(options.to) });
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: resolvedSender.name,
          email: resolvedSender.email,
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error("email.brevo", "Brevo API error", {
        status: res.status,
        to: redactEmail(options.to),
        subject: options.subject,
      });
      return { success: false, error: err };
    }

    const data = (await res.json()) as { messageId?: string };
    logger.info("email.send", "Brevo sent", {
      messageId: data.messageId,
      to: redactEmail(options.to),
    });
    return { success: true, id: data.messageId };
  } catch (error) {
    logger.error(
      "email.brevo",
      "Brevo request failed",
      { to: redactEmail(options.to), subject: options.subject },
      error,
    );
    return { success: false, error: String(error) };
  }
}
