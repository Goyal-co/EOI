import { prisma } from "@goyal/db";
import { withAuth, apiResponse, withApiRoute } from "@/lib/api";
import { DocumentService } from "@/lib/services/document";

type ProjectAssetRow = {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
};

async function resolveAssetUrl(fileUrl: string | null): Promise<string | null> {
  return DocumentService.resolveAccessibleUrl(fileUrl);
}

function mapEoiEntry(eoi: {
  id: string;
  status: string;
  referenceNumber: string | null;
  confirmationNumber: string | null;
  chequeUploaded: boolean;
  chequeNumber: string | null;
  adminRemarks: string | null;
  rejectionReason: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  lead: { customerName: string; journeyStatus: string };
  project: {
    id: string;
    name: string;
    location: string;
    locationLink?: string | null;
    startingPrice: unknown;
    possessionDate: Date | null;
    bannerUrl: string | null;
    locationImageUrl: string | null;
    amenities: string[];
    description: string | null;
    faqs: unknown;
    eoiStatus: string;
    assets?: ProjectAssetRow[];
  };
  cp: { user: { name: string | null } };
}, resolvedBannerUrl: string | null, resolvedLocationImageUrl: string | null) {
  return {
    eoi: {
      id: eoi.id,
      status: eoi.status,
      journeyStatus: eoi.lead.journeyStatus,
      referenceNumber: eoi.referenceNumber,
      confirmationNumber: eoi.confirmationNumber,
      chequeUploaded: eoi.chequeUploaded,
      chequeNumber: eoi.chequeNumber,
      adminRemarks: eoi.adminRemarks,
      rejectionReason: eoi.rejectionReason,
      submittedAt: eoi.submittedAt,
      approvedAt: eoi.approvedAt,
    },
    project: {
      id: eoi.project.id,
      name: eoi.project.name,
      location: eoi.project.location,
      locationLink: eoi.project.locationLink,
      startingPrice: Number(eoi.project.startingPrice),
      possessionDate: eoi.project.possessionDate,
      bannerUrl: resolvedBannerUrl ?? eoi.project.bannerUrl,
      locationImageUrl: resolvedLocationImageUrl ?? eoi.project.locationImageUrl,
      amenities: eoi.project.amenities,
      description: eoi.project.description,
      faqs: (eoi.project.faqs as Array<{ question: string; answer: string }> | null) || [],
      eoiStatus: eoi.project.eoiStatus,
      assets: eoi.project.assets ?? [],
    },
    cpName: eoi.cp.user.name,
    customerName: eoi.lead.customerName,
    journeyStatus: eoi.lead.journeyStatus,
  };
}

export const GET = withApiRoute("customer.dashboard.get", async (req: Request) => {
  const { error, session } = await withAuth(["CUSTOMER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const requestedEoiId = searchParams.get("eoiId");

  const eois = await prisma.eOI.findMany({
    where: { customer: { userId: session!.user.id } },
    include: {
      lead: true,
      project: { include: { assets: true } },
      cp: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingLeads = await prisma.lead.findMany({
    where: {
      customerEmail: session!.user.email!,
      customerId: null,
      confirmationStatus: "ACCEPTED",
    },
    include: {
      project: { include: { assets: true } },
      cp: { include: { user: { select: { name: true } } } },
      eoi: true,
    },
  });

  const entries = await Promise.all([
    ...eois.map(async (e) => {
      const [bannerUrl, locationImageUrl] = await Promise.all([
        resolveAssetUrl(e.project.bannerUrl),
        resolveAssetUrl(e.project.locationImageUrl),
      ]);
      return { eoiId: e.id, ...mapEoiEntry(e, bannerUrl, locationImageUrl) };
    }),
    ...pendingLeads.map(async (l) => ({
      eoiId: l.eoi?.id || null,
      eoi: {
        id: l.eoi?.id,
        status: l.eoi?.status || l.journeyStatus,
        referenceNumber: l.eoi?.referenceNumber || null,
      },
      project: {
        ...l.project,
        startingPrice: Number(l.project.startingPrice),
        bannerUrl: await resolveAssetUrl(l.project.bannerUrl),
        locationImageUrl: await resolveAssetUrl(l.project.locationImageUrl),
        faqs: (l.project.faqs as Array<{ question: string; answer: string }> | null) || [],
        assets: l.project.assets ?? [],
      },
      cpName: l.cp.user.name,
      customerName: l.customerName,
      journeyStatus: l.journeyStatus,
    })),
  ]);

  if (entries.length === 0) {
    return apiResponse({ hasEOI: false, eois: [], activeEoiId: null });
  }

  const active = requestedEoiId
    ? entries.find((e) => e.eoiId === requestedEoiId) || entries[0]
    : entries[0];

  return apiResponse({
    hasEOI: true,
    eois: entries,
    activeEoiId: active.eoiId,
    ...active,
  });
});
