"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, cn } from "@goyal/ui";
import { Download, ExternalLink } from "lucide-react";
import { openPresignedAsset, getPresignedUrlForPreview, isImageFileName } from "@/lib/files/open-asset";

export interface ProjectAssetItem {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
}

const ASSET_TYPE_MAP: Record<string, string> = {
  brochure: "BROCHURE",
  "floor-plans": "FLOOR_PLAN",
  "cost-sheet": "COST_SHEET",
  gallery: "GALLERY",
};

export type ProjectAssetTab = keyof typeof ASSET_TYPE_MAP;

interface ProjectAssetsPanelProps {
  assets: ProjectAssetItem[];
  tab: ProjectAssetTab;
  downloadApiPrefix: "/api/customer/assets" | "/api/partner/assets";
}

function getAssetsForTab(assets: ProjectAssetItem[], tab: ProjectAssetTab) {
  const type = ASSET_TYPE_MAP[tab];
  return assets.filter((a) => a.type === type);
}

export function ProjectAssetsPanel({ assets, tab, downloadApiPrefix }: ProjectAssetsPanelProps) {
  const items = getAssetsForTab(assets, tab);
  const tabLabel = tab.replace("-", " ");

  if (items.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title="No files available"
          description={`${tabLabel} files will appear here when uploaded by admin`}
        />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className={cn("gap-4", tab === "gallery" ? "grid sm:grid-cols-2 lg:grid-cols-3" : "space-y-3")}>
        {items.map((asset) => (
          tab === "gallery" ? (
            <GalleryAssetCard
              key={asset.id}
              asset={asset}
              downloadApiPrefix={downloadApiPrefix}
            />
          ) : (
            <FileAssetRow
              key={asset.id}
              asset={asset}
              downloadApiPrefix={downloadApiPrefix}
            />
          )
        ))}
      </div>
    </Card>
  );
}

function FileAssetRow({
  asset,
  downloadApiPrefix,
}: {
  asset: ProjectAssetItem;
  downloadApiPrefix: ProjectAssetsPanelProps["downloadApiPrefix"];
}) {
  const apiPath = `${downloadApiPrefix}/${asset.id}/download`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{asset.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{asset.type.replace("_", " ")}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath)}>
          <ExternalLink className="h-4 w-4" />
          View
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openPresignedAsset(apiPath)}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function GalleryAssetCard({
  asset,
  downloadApiPrefix,
}: {
  asset: ProjectAssetItem;
  downloadApiPrefix: ProjectAssetsPanelProps["downloadApiPrefix"];
}) {
  const apiPath = `${downloadApiPrefix}/${asset.id}/download`;
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPresignedUrlForPreview(apiPath)
      .then((url) => { if (!cancelled) setImgSrc(url); })
      .catch(() => { if (!cancelled) setImgSrc(asset.fileUrl); });
    return () => { cancelled = true; };
  }, [apiPath, asset.fileUrl]);

  return (
    <button
      type="button"
      onClick={() => openPresignedAsset(apiPath)}
      className="block rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow text-left w-full"
    >
      {imgSrc ? (
        <img src={imgSrc} alt={asset.fileName} className="h-48 w-full object-cover" />
      ) : (
        <div className="h-48 w-full bg-muted animate-pulse" />
      )}
      <p className="p-2 text-xs text-muted-foreground truncate">{asset.fileName}</p>
    </button>
  );
}

export { ASSET_TYPE_MAP, getAssetsForTab };
export function isAssetImage(fileName: string) {
  return isImageFileName(fileName);
}
