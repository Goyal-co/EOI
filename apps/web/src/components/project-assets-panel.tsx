"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, cn } from "@goyal/ui";
import { Download, ExternalLink, FileText } from "lucide-react";
import {
  openPresignedAsset,
  downloadPresignedAsset,
  inlinePreviewUrl,
  publicFilesUrl,
  resolvePreviewKind,
  type AssetPreviewKind,
} from "@/lib/files/open-asset";

/** Authenticated preview for img/video — same cookies as fetch, clearer than bare img src. */
function useAuthedObjectUrl(apiPath: string, enabled = true) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);
    setSrc(null);

    (async () => {
      try {
        const res = await fetch(inlinePreviewUrl(apiPath), { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiPath, enabled]);

  return { src, failed, setFailed };
}

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
  return assets.filter((a) => String(a.type || "").toUpperCase() === type);
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
          description={
            tab === "creatives"
              ? "Ask admin to upload files under Manage Assets → Creative on this existing project. No need to recreate the project."
              : `${tabLabel} files will appear here when uploaded by admin`
          }
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
        <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath, asset.fileUrl)}>
          <ExternalLink className="h-4 w-4" />
          View
        </Button>
        <Button variant="ghost" size="sm" onClick={() => downloadPresignedAsset(apiPath, asset.fileUrl)}>
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
  const kind = assetPreviewKind(asset);
  const directUrl = publicFilesUrl(asset.fileUrl, "inline");
  const needsObjectUrl = !directUrl && (kind === "image" || kind === "pdf");
  const { src: authedSrc, failed, setFailed } = useAuthedObjectUrl(apiPath, needsObjectUrl);
  const src = directUrl || authedSrc;

  if (failed) {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 shrink-0" />
          <span className="truncate">{asset.fileName}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath, asset.fileUrl)}>
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
          <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath, asset.fileUrl)}>
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
        </div>
        {kind === "pdf" && src ? (
          <iframe
            title={asset.fileName}
            src={src}
            className="w-full h-48 border-t border-border bg-white"
          />
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openPresignedAsset(apiPath, asset.fileUrl)}
      className="block rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow text-left w-full"
    >
      {src ? (
        <img
          src={src}
          alt={asset.fileName}
          className="h-48 w-full object-cover bg-muted"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-48 w-full bg-muted animate-pulse" />
      )}
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
  const directUrl = publicFilesUrl(asset.fileUrl, "inline");
  const { src: authedSrc, failed } = useAuthedObjectUrl(apiPath, !directUrl);
  const src = directUrl || authedSrc;

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {src && !failed ? (
        <video
          src={src}
          controls
          className="w-full max-h-96 bg-black"
        />
      ) : failed ? (
        <div className="flex items-center justify-between p-4">
          <p className="text-sm font-medium truncate">{asset.fileName}</p>
          <Button variant="outline" size="sm" onClick={() => openPresignedAsset(apiPath, asset.fileUrl)}>
            <ExternalLink className="h-4 w-4" />
            View
          </Button>
        </div>
      ) : (
        <div className="h-48 w-full bg-muted animate-pulse" />
      )}
      <p className="p-2 text-xs text-muted-foreground truncate">{asset.fileName}</p>
    </div>
  );
}

export { ASSET_TYPE_MAP, getAssetsForTab };
export function isAssetImage(fileName: string) {
  return resolvePreviewKind({ fileName }) === "image";
}
