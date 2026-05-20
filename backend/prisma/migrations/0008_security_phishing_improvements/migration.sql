-- Fix #2: refresh token rotation storage
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix #4: track failed verification code attempts to enable lockout
ALTER TABLE "EmailVerification" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;

-- Fix #9: passing score threshold on quizzes
ALTER TABLE "Quiz" ADD COLUMN "passingScore" INTEGER;

-- Fix #9: track pass/fail on attempts
ALTER TABLE "Attempt" ADD COLUMN "isPassed" BOOLEAN;

-- Fix #13: explicit ordering for questions
ALTER TABLE "Question" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Fix #11: phishing campaign simulation
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SENT', 'ARCHIVED');

CREATE TABLE "PhishingCampaign" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhishingCampaign_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PhishingCampaign" ADD CONSTRAINT "PhishingCampaign_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhishingCampaign" ADD CONSTRAINT "PhishingCampaign_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignTarget" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignTarget_token_key" ON "CampaignTarget"("token");
CREATE UNIQUE INDEX "CampaignTarget_campaignId_userId_key" ON "CampaignTarget"("campaignId", "userId");

ALTER TABLE "CampaignTarget" ADD CONSTRAINT "CampaignTarget_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "PhishingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignTarget" ADD CONSTRAINT "CampaignTarget_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
