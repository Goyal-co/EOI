import { prisma } from "@goyal/db";
import { sendEmail, type EmailOptions, type EmailSendResult } from "./service";

const MAX_RETRIES = 3;

export interface SendEmailParams extends EmailOptions {
  type?: string;
  entityType?: string;
  entityId?: string;
}

export type SendEmailWithLogResult = EmailSendResult & { skipped?: boolean };

export async function sendEmailWithLog(params: SendEmailParams): Promise<SendEmailWithLogResult> {
  const log = await prisma.emailLog.create({
    data: {
      to: params.to,
      subject: params.subject,
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      html: params.html,
      status: "PENDING",
    },
  });

  const result = await sendEmail(params);

  if (result.success && !result.mocked) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerId: result.id, sentAt: new Date() },
    });
    return result;
  }

  if (result.mocked) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        error: "MOCK_MODE: BREVO_API_KEY not loaded — restart server after updating .env.local",
        providerId: result.id,
      },
    });
    return result;
  }

  await prisma.emailLog.update({
    where: { id: log.id },
    data: { status: "FAILED", error: result.error, retryCount: 1 },
  });

  await enqueueEmailRetry(log.id);
  return result;
}

export async function enqueueEmailRetry(emailLogId: string): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    await redis.lpush("email:retry", emailLogId);
    await redis.quit();
  } catch {
    // Redis unavailable — retry handled via DB status
  }
}

export async function processEmailRetryQueue(limit = 10): Promise<number> {
  if (!process.env.REDIS_URL) return 0;

  let processed = 0;
  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();

    for (let i = 0; i < limit; i++) {
      const emailLogId = await redis.rpop("email:retry");
      if (!emailLogId) break;

      const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
      if (!log || !log.html || log.retryCount >= MAX_RETRIES) continue;

      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "RETRYING" },
      });

      const result = await sendEmail({ to: log.to, subject: log.subject, html: log.html });

      if (result.success) {
        await prisma.emailLog.update({
          where: { id: log.id },
          data: { status: "SENT", providerId: result.id, sentAt: new Date(), error: null },
        });
      } else {
        const nextRetry = log.retryCount + 1;
        await prisma.emailLog.update({
          where: { id: log.id },
          data: {
            status: nextRetry >= MAX_RETRIES ? "FAILED" : "FAILED",
            error: result.error,
            retryCount: nextRetry,
          },
        });
        if (nextRetry < MAX_RETRIES) {
          await redis.lpush("email:retry", log.id);
        }
      }
      processed += 1;
    }

    await redis.quit();
  } catch {
    // swallow — queue processing is best-effort
  }

  return processed;
}
