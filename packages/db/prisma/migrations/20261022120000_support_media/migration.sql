-- Ticket chat can store image, video, and audio without changing project gallery rules.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'SUPPORT_MEDIA';
