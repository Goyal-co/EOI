-- Partner dashboard promotional carousel creatives (admin-managed)

CREATE TABLE IF NOT EXISTS "PartnerPromotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaKind" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPromotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerPromotion_active_sortOrder_idx" ON "PartnerPromotion"("active", "sortOrder");
CREATE INDEX IF NOT EXISTS "PartnerPromotion_startsAt_endsAt_idx" ON "PartnerPromotion"("startsAt", "endsAt");
