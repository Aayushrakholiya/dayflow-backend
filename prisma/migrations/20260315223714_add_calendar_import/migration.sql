-- CreateTable
CREATE TABLE "ExternalCalendarToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalCalendarToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startHour" DOUBLE PRECISION NOT NULL,
    "endHour" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "locationOverride" TEXT,
    "description" TEXT,
    "attendees" TEXT[],
    "videoconferencing" TEXT,
    "color" TEXT NOT NULL,
    "calendarName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarToken_userId_provider_key" ON "ExternalCalendarToken"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedEvent_userId_externalId_source_key" ON "ImportedEvent"("userId", "externalId", "source");

-- AddForeignKey
ALTER TABLE "ExternalCalendarToken" ADD CONSTRAINT "ExternalCalendarToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedEvent" ADD CONSTRAINT "ImportedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
