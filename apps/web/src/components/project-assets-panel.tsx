"use client";

import { useState } from "react";
import { Button, Card, EmptyState, cn } from "@goyal/ui";
import { Download, ExternalLink, FileText } from "lucide-react";
import {
  openPresignedAsset,
  downloadPresignedAsset,
  inlinePreviewUrl,
  resolvePreviewKind,
  type AssetPreviewKind,
} from "@/lib/files/open-asset";

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
  creatives: "CREATIVE",
  walkthrough: "WALKTHROUGH",
  location: "LOCATION",
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

function assetPreviewKind(asset: ProjectAssetItem): AssetPreviewKind {
  return resolvePreviewKind({
    fileName: asset.fileName,
    fileUrl: asset.fileUrl,
    assetType: asset.type,
  });
}

export function ProjectAssetsPanel({ assets, tab, downloadApiPrefix }: ProjectAssetsPanelProps) {
  const items = getAssetsForTab(assets, tab);
  const tabLabel = tab.replace("-", " ");
  const gridTabs = tab === "gallery" || tab === "creatives";

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
      <div className={cn("gap-4", gridTabs ? "grid sm:grid-cols-2 lg:grid-cols-3" : "space-y-3")}>
        {items.map((asset) => (
          tab === "walkthrough" ? (
            <WalkthroughAssetCard
              key={asset.id}
              asset={asset}
              downloadApiPrefix={downloadApiPrefix}
            />
          ) : gridTabs ? (
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
        <Button variant="ghost" size="sm" onClick={() => downloadPresignedAsset(apiPath)}>
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
  const previewUrl = inlinePreviewUrl(apiPath);
  const kind = assetPreviewKind(asset);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 shrink-0" />
          <span className="truncate">{asset.fileName}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath)}>
          <ExternalLink className="h-4 w-4" />
          View
        </Button>
      </div>
    );
  }

  if (kind === "pdf" || kind === "other") {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4">
          <div className="min-w-0 flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{asset.fileName}</p>
              <p className="text-xs text-muted-foreground">{kind === "pdf" ? "PDF" : "File"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath)}>
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
        </div>
        {kind === "pdf" ? (
          <iframe
            title={asset.fileName}
            src={`${previewUrl}#toolbar=0&navpanes=0`}
            className="w-full h-48 border-t border-border bg-white"
          />
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openPresignedAsset(apiPath)}
      className="block rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow text-left w-full"
    >
      <img
        src={previewUrl}
        alt={asset.fileName}
        className="h-48 w-full object-cover bg-muted"
        onError={() => setFailed(true)}
      />
      <p className="p-2 text-xs text-muted-foreground truncate">{asset.fileName}</p>
    </button>
  );
}

function WalkthroughAssetCard({
  asset,
  downloadApiPrefix,
}: {
  asset: ProjectAssetItem;
  downloadApiPrefix: ProjectAssetsPanelProps["downloadApiPrefix"];
}) {
  const apiPath = `${downloadApiPrefix}/${asset.id}/download`;
  const previewUrl = inlinePreviewUrl(apiPath);
  const [failed, setFailed] = useState(false);

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {!failed ? (
        <video
          src={previewUrl}
          controls
          className="w-full max-h-96 bg-black"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex items-center justify-between p-4">
          <p className="text-sm font-medium truncate">{asset.fileName}</p>
          <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath)}>
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
        </div>
      )}
      <p className="p-2 text-xs text-muted-foreground truncate">{asset.fileName}</p>
    </div>
  );
}

export { ASSET_TYPE_MAP, getAssetsForTab };
export function isAssetImage(fileName: string) {
  return resolvePreviewKind({ fileName }) === "image";
}
