import { PrismaClient, UserRole, CPStatus, ProjectEOIStatus, ProjectStatus, EOIStatus, LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_EMAIL_TEMPLATE_BODIES, DEFAULT_EMAIL_TEMPLATE_SUBJECTS } from "../../email/src/templates";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const partnerPassword = await bcrypt.hash("Partner@123", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@goyalprojects.com" },
    update: {},
    create: {
      email: "admin@goyalprojects.com",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      name: "Admin User",
      status: "ACTIVE",
      adminProfile: { create: {} },
    },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: "partner@goyalprojects.com" },
    update: {},
    create: {
      email: "partner@goyalprojects.com",
      passwordHash: partnerPassword,
      role: UserRole.CHANNEL_PARTNER,
      name: "Rajesh Sharma",
      status: "ACTIVE",
      cpProfile: {
        create: {
          companyName: "Sharma Realty Partners",
          mobile: "9876543210",
          reraNumber: "P52100012345",
          panNumber: "AABCS1234F",
          gstNumber: "27AABCS1234F1Z5",
          officeAddress: "101, Business Park, Andheri East",
          city: "Mumbai",
          status: CPStatus.APPROVED,
        },
      },
    },
  });

  await prisma.user.update({
    where: { email: "partner@goyalprojects.com" },
    data: {
      passwordHash: partnerPassword,
      status: "ACTIVE",
      cpProfile: { update: { status: CPStatus.APPROVED, blockReason: null } },
    },
  });

  const cp = await prisma.channelPartner.findUnique({
    where: { userId: partnerUser.id },
  });

  const defaultFaqs = [
    { question: "What is the EOI process?", answer: "Submit customer details through the partner portal. The customer receives an invite link to complete their EOI form online." },
    { question: "What documents are required?", answer: "Customers need PAN, Aadhaar, and a cheque for EOI amount. Specific requirements may vary by project." },
    { question: "How long does approval take?", answer: "EOI approvals typically take 3-5 business days after complete submission." },
    { question: "Can I submit multiple EOIs?", answer: "Yes, you can submit EOIs for multiple customers on the same project." },
  ];

  const projects = await Promise.all([
    prisma.project.upsert({
      where: { id: "seed-project-1" },
      update: { faqs: defaultFaqs },
      create: {
        id: "seed-project-1",
        name: "Goyal Heights",
        location: "Bandra West, Mumbai",
        startingPrice: 25000000,
        possessionDate: new Date("2027-06-01"),
        description: "Luxury high-rise residences with panoramic sea views and world-class amenities.",
        amenities: ["Swimming Pool", "Gym", "Clubhouse", "Landscaped Gardens", "24/7 Security", "Concierge"],
        faqs: defaultFaqs,
        eoiStatus: ProjectEOIStatus.OPEN,
        status: ProjectStatus.ACTIVE,
        bannerUrl: "/images/projects/goyal-heights.jpg",
      },
    }),
    prisma.project.upsert({
      where: { id: "seed-project-2" },
      update: { faqs: defaultFaqs },
      create: {
        id: "seed-project-2",
        name: "Goyal Residency",
        location: "Powai, Mumbai",
        startingPrice: 18000000,
        possessionDate: new Date("2028-03-01"),
        description: "Premium lake-view apartments in the heart of Powai.",
        amenities: ["Infinity Pool", "Spa", "Kids Play Area", "Jogging Track", "EV Charging"],
        faqs: defaultFaqs,
        eoiStatus: ProjectEOIStatus.OPEN,
        status: ProjectStatus.ACTIVE,
        bannerUrl: "/images/projects/goyal-residency.jpg",
      },
    }),
    prisma.project.upsert({
      where: { id: "seed-project-3" },
      update: { faqs: defaultFaqs },
      create: {
        id: "seed-project-3",
        name: "Goyal Enclave",
        location: "Thane West",
        startingPrice: 12000000,
        possessionDate: new Date("2026-12-01"),
        description: "Affordable luxury living with excellent connectivity.",
        amenities: ["Community Hall", "Indoor Games", "Power Backup", "Rainwater Harvesting"],
        faqs: defaultFaqs,
        eoiStatus: ProjectEOIStatus.CLOSED,
        status: ProjectStatus.ACTIVE,
        bannerUrl: "/images/projects/goyal-enclave.jpg",
      },
    }),
  ]);

  if (cp) {
    for (const project of projects) {
      await prisma.cPProjectAccess.upsert({
        where: { cpId_projectId: { cpId: cp.id, projectId: project.id } },
        update: {},
        create: { cpId: cp.id, projectId: project.id },
      });
    }

    const lead = await prisma.lead.upsert({
      where: { inviteToken: "demo-invite-token-123" },
      update: {
        fosName: "Rahul Mehta",
        journeyStatus: "SUBMITTED",
        confirmationStatus: "ACCEPTED",
        confirmationSentAt: new Date(),
      },
      create: {
        cpId: cp.id,
        projectId: projects[0].id,
        customerName: "Amit Patel",
        customerEmail: "amit.patel@example.com",
        customerMobile: "9876543210",
        configuration: "3 BHK",
        fosName: "Rahul Mehta",
        budget: "2.5 - 3 Cr",
        city: "Mumbai",
        journeyStatus: "SUBMITTED",
        confirmationStatus: "ACCEPTED",
        confirmationSentAt: new Date(),
        leadStatus: LeadStatus.LEAD_REGISTERED,
        inviteToken: "demo-invite-token-123",
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const demoFormData = {
      personal: {
        fullName: "Amit Patel",
        dob: "1990-05-15",
        gender: "MALE",
        mobile: "9876543210",
        email: "amit.patel@example.com",
        panNumber: "ABCDE1234F",
        aadhaarNumber: "123456789012",
      },
      address: {
        currentAddress: "42 Marine Drive, Mumbai",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        occupation: "Business Owner",
        annualIncome: "50L - 1Cr",
      },
      unitPreference: {
        preferredConfiguration: "3 BHK",
        budgetRange: "2.5 - 3 Cr",
      },
      bankDetails: {
        bankName: "HDFC Bank",
        accountHolderName: "Amit Patel",
        chequeNumber: "000123456789",
      },
    };

    const existingEoi = await prisma.eOI.findFirst({ where: { leadId: lead.id } });
    const demoEoi = existingEoi
      ? await prisma.eOI.update({
          where: { id: existingEoi.id },
          data: {
            status: EOIStatus.SUBMITTED,
            referenceNumber: "EOI-2026-DEMO01",
            chequeNumber: "000123456789",
            chequeUploaded: true,
            submittedAt: new Date(),
            formData: demoFormData,
          },
        })
      : await prisma.eOI.create({
          data: {
            id: "seed-demo-eoi-submitted",
            leadId: lead.id,
            projectId: projects[0].id,
            cpId: cp.id,
            status: EOIStatus.SUBMITTED,
            referenceNumber: "EOI-2026-DEMO01",
            chequeNumber: "000123456789",
            chequeUploaded: true,
            submittedAt: new Date(),
            formData: demoFormData,
          },
        });

    await prisma.document.upsert({
      where: { id: "seed-demo-cheque-doc" },
      update: {},
      create: {
        id: "seed-demo-cheque-doc",
        eoiId: demoEoi.id,
        type: "CHEQUE",
        fileName: "cancelled-cheque-demo.jpg",
        fileUrl: "http://localhost:9000/goyal-eoi-documents/customer/demo/cheque/cancelled-cheque-demo.jpg",
        mimeType: "image/jpeg",
        fileSize: 102400,
        status: "PENDING",
      },
    });
  }

  for (const [type, body] of Object.entries(DEFAULT_EMAIL_TEMPLATE_BODIES)) {
    const subject = DEFAULT_EMAIL_TEMPLATE_SUBJECTS[type] || type.replace(/_/g, " ");
    await prisma.emailTemplate.upsert({
      where: { type },
      update: { subject, body },
      create: { type, subject, body },
    });
  }

  console.log("Seed completed:", { adminUser: adminUser.email, partnerUser: partnerUser.email, projects: projects.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
