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
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "Goyal Projects";

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
    console.warn("[Email] MOCK MODE — BREVO_API_KEY not loaded. Restart the server after updating .env.local");
    console.log("[Email Mock] From:", `${resolvedSender.name} <${resolvedSender.email}>`);
    console.log("[Email Mock] To:", options.to);
    console.log("[Email Mock] Subject:", options.subject);
    const linkMatch = options.html.match(/href="(https?:\/\/[^"]+)"/g);
    if (linkMatch?.length) {
      console.log("[Email Mock] Links:", linkMatch.map((l) => l.replace(/^href="|"$/g, "")).join("\n  "));
    }
    return { success: true, id: `mock-${Date.now()}`, mocked: true };
  }

  const apiKey = getBrevoApiKey()!;
  console.log("[Email] Sending via Brevo to:", options.to);
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
        htmlContent: options.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] Brevo API error:", err);
      return { success: false, error: err };
    }

    const data = (await res.json()) as { messageId?: string };
    console.log("[Email] Brevo sent:", data.messageId);
    return { success: true, id: data.messageId };
  } catch (error) {
    console.error("[Email] Brevo request failed:", error);
    return { success: false, error: String(error) };
  }
}
