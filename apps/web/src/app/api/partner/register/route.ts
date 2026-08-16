import bcrypt from "bcryptjs";
import { prisma } from "@goyal/db";
import { cpRegisterStep1Schema, cpRegisterStep2Schema, type DocumentType } from "@goyal/types";
import { apiResponse, apiError } from "@/lib/api";
import { NotificationService } from "@goyal/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isUniqueConstraintError } from "@goyal/db";
import { checkCpRegistrationEmail } from "@/lib/registration/email-conflict";
import { DocumentService } from "@/lib/services/document";

async function parseRegisterBody(req: Request): Promise<{
  step: number;
  data: unknown;
  files: Partial<Record<"reraCert" | "gstCert" | "cheque" | "panDoc", File>>;
}> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const step = Number(form.get("step"));
    const step1Raw = form.get("step1");
    const step2Raw = form.get("step2");
    const dataRaw = form.get("data");
    const files: Partial<Record<"reraCert" | "gstCert" | "cheque" | "panDoc", File>> = {};
    for (const key of ["reraCert", "gstCert", "cheque", "panDoc"] as const) {
      const value = form.get(key);
      if (value instanceof File && value.size > 0) files[key] = value;
    }
    if (step === 3) {
      return {
        step,
        data: {
          step1: typeof step1Raw === "string" ? JSON.parse(step1Raw) : step1Raw,
          step2: typeof step2Raw === "string" ? JSON.parse(step2Raw) : step2Raw,
        },
        files,
      };
    }
    return {
      step,
      data: typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw,
      files,
    };
  }

  const body = await req.json();
  return { step: body.step, data: body.data, files: {} };
}

async function saveRegistrationDoc(
  cpId: string,
  userId: string,
  type: DocumentType,
  file: File,
) {
  const mimeType =
    DocumentService.mimeTypeFromFileName(file.name)
    || (file.type && file.type !== "application/octet-stream" ? file.type : "")
    || "application/octet-stream";
  const validationError = DocumentService.validateFile(type, mimeType, file.size);
  if (validationError) throw new Error(validationError);

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = DocumentService.getScopedFolder("CHANNEL_PARTNER", userId, type);
  const uploaded = await DocumentService.uploadBuffer({
    fileName: file.name,
    mimeType,
    folder,
    body: buffer,
    size: file.size,
  });

  await DocumentService.saveDocument({
    type,
    fileName: file.name,
    fileUrl: uploaded.fileUrl,
    fileSize: file.size,
    mimeType,
    cpId,
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limited = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.ok) return apiError("Too many registration attempts. Try again later.", 429);

  let step: number;
  let data: unknown;
  let files: Partial<Record<"reraCert" | "gstCert" | "cheque" | "panDoc", File>>;
  try {
    ({ step, data, files } = await parseRegisterBody(req));
  } catch {
    return apiError("Invalid registration payload");
  }

  if (step === 1) {
    const parsed = cpRegisterStep1Schema.safeParse(data);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);

    const emailCheck = await checkCpRegistrationEmail(parsed.data.email);
    if (!emailCheck.allowed) {
      return apiError(emailCheck.message || "Email already registered", 409, emailCheck.code);
    }

    return apiResponse({
      valid: true,
      accountConversion: !!emailCheck.convertUserId,
      leadRecordExists: !!emailCheck.leadOnly,
      notice: emailCheck.message,
    });
  }

  if (step === 2) {
    const parsed = cpRegisterStep2Schema.safeParse(data);
    if (!parsed.success) return apiError(parsed.error.errors[0].message);
    return apiResponse({ valid: true });
  }

  if (step === 3) {
    const payload = data as { step1: unknown; step2: unknown };
    const step1 = cpRegisterStep1Schema.safeParse(payload.step1);
    const step2 = cpRegisterStep2Schema.safeParse(payload.step2);
    if (!step1.success) return apiError(step1.error.errors[0].message);
    if (!step2.success) return apiError(step2.error.errors[0].message);

    if (!files.reraCert) return apiError("RERA certificate PDF is required");
    if (!files.panDoc) return apiError("PAN document PDF is required");
    if (!files.cheque) return apiError("Cancelled cheque image is required");

    const emailCheck = await checkCpRegistrationEmail(step1.data.email);
    if (!emailCheck.allowed) {
      return apiError(emailCheck.message || "Email already registered", 409, emailCheck.code);
    }

    const passwordHash = await bcrypt.hash(step1.data.password, 12);

    try {
      let userId: string;
      let cpId: string;

      if (emailCheck.convertUserId) {
        const user = await prisma.$transaction(async (tx) => {
          const customer = await tx.customer.findUnique({
            where: { userId: emailCheck.convertUserId! },
          });
          if (customer) {
            await tx.lead.updateMany({
              where: { customerId: customer.id },
              data: { customerId: null },
            });
            await tx.customer.delete({ where: { id: customer.id } });
          }

          return tx.user.update({
            where: { id: emailCheck.convertUserId! },
            data: {
              passwordHash,
              name: step1.data.fullName,
              role: "CHANNEL_PARTNER",
              status: "PENDING",
              cpProfile: {
                create: {
                  companyName: step2.data.companyName,
                  mobile: step1.data.mobile,
                  reraNumber: step2.data.reraNumber,
                  panNumber: step2.data.panNumber,
                  gstNumber: step2.data.gstNumber || null,
                  status: "PENDING",
                },
              },
            },
            include: { cpProfile: true },
          });
        });
        userId = user.id;
        cpId = user.cpProfile!.id;
      } else {
        const user = await prisma.user.create({
          data: {
            email: step1.data.email,
            passwordHash,
            name: step1.data.fullName,
            role: "CHANNEL_PARTNER",
            status: "PENDING",
            cpProfile: {
              create: {
                companyName: step2.data.companyName,
                mobile: step1.data.mobile,
                reraNumber: step2.data.reraNumber,
                panNumber: step2.data.panNumber,
                gstNumber: step2.data.gstNumber || null,
                status: "PENDING",
              },
            },
          },
          include: { cpProfile: true },
        });
        userId = user.id;
        cpId = user.cpProfile!.id;
      }

      try {
        await saveRegistrationDoc(cpId, userId, "RERA_CERT", files.reraCert);
        await saveRegistrationDoc(cpId, userId, "PAN", files.panDoc);
        await saveRegistrationDoc(cpId, userId, "CHEQUE", files.cheque);
        if (files.gstCert) {
          await saveRegistrationDoc(cpId, userId, "GST_CERT", files.gstCert);
        }
      } catch (uploadErr) {
        return apiError(
          uploadErr instanceof Error ? uploadErr.message : "Failed to upload registration documents",
          400,
        );
      }

      await NotificationService.notifyCPRegistrationAck({
        cpEmail: step1.data.email,
        cpName: step1.data.fullName,
      });

      const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
      for (const admin of admins) {
        await NotificationService.notifyCPRegistered({
          adminUserId: admin.id,
          cpName: step1.data.fullName,
          companyName: step2.data.companyName,
        });
      }

      return apiResponse({ success: true, userId }, 201);
    } catch (error) {
      if (isUniqueConstraintError(error, "email")) {
        return apiError("Email already registered", 409, "DUPLICATE_EMAIL");
      }
      throw error;
    }
  }

  return apiError("Invalid step");
}
