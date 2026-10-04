-- Partner Portal Guide videos (admin-managed)

CREATE TABLE IF NOT EXISTS "PortalGuideVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "durationLabel" TEXT,
    "durationSec" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalGuideVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PortalGuideVideo_active_sortOrder_idx" ON "PortalGuideVideo"("active", "sortOrder");
CREATE INDEX IF NOT EXISTS "PortalGuideVideo_featured_idx" ON "PortalGuideVideo"("featured");
