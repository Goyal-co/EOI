import { DocumentService } from "@/lib/services/document";

export async function resolveProjectBannerUrl(
  bannerUrl: string | null | undefined
): Promise<string | null> {
  return DocumentService.resolveAccessibleUrl(bannerUrl);
}
