import { prisma } from "@goyal/db";
import { apiResponse, apiError } from "@/lib/api";
import { EOIEngine } from "@/lib/services/eoi-engine";
import { encryptFormData } from "@/lib/services/form-data-pii";
import bcrypt from "bcryptjs";

function isTestEnv(req: Request) {
  if (process.env.NODE_ENV === "test") return true;
  const secret = process.env.TEST_ROUTE_SECRET;
  if (!secret) return false;
  return req.headers.get("x-test-secret") === secret;
}

export async function POST(req: Request) {
  if (!isTestEnv(req)) return apiError("Not found", 404);

  const body = await req.json();
  const inviteToken = body.inviteToken as string;
  if (!inviteToken) return apiError("inviteToken required");

  const lead = await prisma.lead.findUnique({
    where: { inviteToken },
    include: { eoi: { include: { documents: true } } },
  });

  if (!lead) return apiError("Lead not found", 404);
  if (lead.confirmationStatus !== "ACCEPTED") {
    return apiError("Lead must be confirmed first", 400);
  }
  if (!lead.eoi) return apiError("EOI not found for lead", 404);

  let customer = await prisma.customer.findFirst({
    where: { user: { email: lead.customerEmail } },
    include: { user: true },
  });

  if (!customer) {
    const passwordHash = await bcrypt.hash("TestCustomer@123", 10);
    const user = await prisma.user.create({
      data: {
        email: lead.customerEmail,
        role: "CUSTOMER",
        name: lead.customerName,
        status: "ACTIVE",
        passwordHash,
        customerProfile: {
          create: {
            fullName: lead.customerName,
            mobile: lead.customerMobile,
          },
        },
      },
      include: { customerProfile: true },
    });
    customer = await prisma.customer.findUnique({
      where: { id: user.customerProfile!.id },
      include: { user: true },
    });
  }

  const formData = encryptFormData({
    personal: {
      fullName: lead.customerName,
      dob: "1990-01-15",
      gender: "MALE",
      mobile: lead.customerMobile,
      email: lead.customerEmail,
      panNumber: "ABCDE1234F",
      aadhaarNumber: "123456789012",
    },
    address: {
      currentAddress: "123 Test Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      occupation: "Engineer",
      annualIncome: "1500000",
    },
    unitPreference: {
      preferredConfiguration: "3 BHK",
      budgetRange: "1.5-2 Cr",
    },
    bankDetails: {
      bankName: "HDFC Bank",
      accountHolderName: lead.customerName,
      chequeNumber: "E2E000123",
    },
  });

  let chequeDoc = lead.eoi.documents.find((d) => d.type === "CHEQUE");
  if (!chequeDoc) {
    chequeDoc = await prisma.document.create({
      data: {
        eoiId: lead.eoi.id,
        type: "CHEQUE",
        fileName: "e2e-cheque.jpg",
        fileUrl: "https://example.com/e2e-cheque.jpg",
        status: "PENDING",
      },
    });
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { customerId: customer!.id },
  });

  await prisma.eOI.update({
    where: { id: lead.eoi.id },
    data: {
      customerId: customer!.id,
      formData: formData as never,
      chequeNumber: "E2E000123",
      chequeUploaded: true,
      status: "DRAFT",
    },
  });

  const result = await EOIEngine.transition({
    eoiId: lead.eoi.id,
    toStatus: "SUBMITTED",
    actorId: customer!.user.id,
    chequeNumber: "E2E000123",
    chequeUploaded: true,
  });

  return apiResponse({ eoiId: lead.eoi.id, referenceNumber: result.referenceNumber });
}
