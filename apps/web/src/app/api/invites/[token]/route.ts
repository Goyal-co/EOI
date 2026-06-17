import { validateInviteToken } from "@goyal/auth";
import { apiResponse, apiError } from "@/lib/api";
import { resolveProjectBannerUrl } from "@/lib/project-banner";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await validateInviteToken(token);

  if (!result.valid) return apiError(result.error!, 404);

  const { lead } = result;
  return apiResponse({
    customerName: lead!.customerName,
    customerEmail: lead!.customerEmail,
    project: {
      id: lead!.project.id,
      name: lead!.project.name,
      location: lead!.project.location,
      locationLink: lead!.project.locationLink,
      startingPrice: lead!.project.startingPrice,
      bannerUrl: await resolveProjectBannerUrl(lead!.project.bannerUrl),
    },
    cpName: lead!.cp.user.name || "Channel Partner",
    companyName: lead!.cp.companyName,
  });
}
