-- Per-project EOI form filler (CUSTOMER | CP) + CP-uploaded EOI document type

CREATE TYPE "EoiFormFiller" AS ENUM ('CUSTOMER', 'CP');

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EOI_DOCUMENT';

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "eoiFormFiller" "EoiFormFiller" NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE "EOI" ADD COLUMN IF NOT EXISTS "filledBy" "EoiFormFiller" NOT NULL DEFAULT 'CUSTOMER';
