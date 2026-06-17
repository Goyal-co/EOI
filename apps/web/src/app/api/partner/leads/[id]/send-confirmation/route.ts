import { prisma } from "@goyal/db";
import { withAuth, apiResponse, apiError, requireApprovedCP } from "@/lib/api";
import { NotificationService } from "@goyal/email";
import { getSMSProvider } from "@goyal/integrations";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await withAuth(["CHANNEL_PARTNER"]);
  if (error) return error;
  const cpError = await requireApprovedCP(session!);
  if (cpError) return cpError;

  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, cpId: session!.user.cpId! },
    include: {
      project: true,
      cp: { include: { user: true } },
    },
  });

  if (!lead) return apiError("Lead not found", 404);
  if (lead.confirmationStatus === "ACCEPTED") {
    return apiError("Customer has already accepted confirmation", 409);
  }
  if (lead.confirmationStatus === "REJECTED") {
    return apiError("Customer rejected the association. Create a new lead.", 409);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptUrl = `${baseUrl}/confirm/${lead.inviteToken}/accept`;
  const rejectUrl = `${baseUrl}/confirm/${lead.inviteToken}/reject`;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      journeyStatus: "CONFIRMATION_PENDING",
      confirmationStatus: "PENDING",
      confirmationSentAt: new Date(),
    },
  });

  const emailResult = await NotificationService.notifyCustomerConfirmation({
    customerEmail: lead.customerEmail,
    customerName: lead.customerName,
    cpName: lead.cp.user.name || "Channel Partner",
    companyName: lead.cp.companyName || undefined,
    projectName: lead.project.name,
    projectLocation: lead.project.location,
    acceptUrl,
    rejectUrl,
    entityId: lead.id,
  });

  const emailSent = !!emailResult.success && !emailResult.skipped && !emailResult.mocked;

  if (emailSent) {
    const sms = getSMSProvider();
    await sms.sendSMS(
      lead.customerMobile,
      `Goyal Hariyana Projects: ${lead.cp.user.name} invites you to confirm your interest in ${lead.project.name}. Check your email for the confirmation link.`
    );
  }

  return apiResponse({
    success: emailSent,
    sentAt: new Date().toISOString(),
    emailError: emailSent
      ? undefined
      : emailResult.mocked
        ? "Email not sent — BREVO_API_KEY not loaded. Restart the dev server after saving .env.local"
        : (emailResult.error || "Failed to send confirmation email"),
    emailMocked: !!emailResult.mocked,
    ...(process.env.NODE_ENV !== "production"
      ? { devConfirmationLinks: { acceptUrl, rejectUrl } }
      : {}),
  });
}
