-- Add SCHEDULED status to CampaignStatus enum
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction on PostgreSQL < 12.
-- If you are on PostgreSQL 12+, this will work fine inside a migration.
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Add scheduledAt to PhishingCampaign
ALTER TABLE "PhishingCampaign" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- Add org-level SMTP credentials for phishing campaigns
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "smtpPassword" TEXT;
