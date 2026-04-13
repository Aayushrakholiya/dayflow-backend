/*  
*  FILE          : googlecalendar.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Handles Google Calendar OAuth2 authentication and event synchronization.
*/ 

import express, { Request, Response } from "express";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import {
  upsertImportedEvents,
  deleteImportedEventsBySource,
} from "./Importedevents";

// ── Prisma (shared singleton) ────────────────────────────────────────────────
import { db } from "./db";

// ── OAuth2 client factory ─────────────────────────────────────────────────────
function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
  );
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ── Router ────────────────────────────────────────────────────────────────────
export default function createGoogleCalendarRouter() {
  const router = express.Router();

  // ── GET /api/google-calendar/auth-url ────────────────────────────────────
  router.get("/auth-url", (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId required" });

    const oauth2Client = makeOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: userId,
      include_granted_scopes: false, // prevent scope accumulation across re-auths
    });

    return res.json({ url });
  });

  // ── GET /api/google-calendar/callback ────────────────────────────────────
  router.get("/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;

    const rawState = req.query.state as string;
    let userId: string;
    try {
      const parsed = JSON.parse(rawState);
      userId = String(parsed.userId ?? parsed);
    } catch {
      userId = rawState;
    }

    if (!code || !userId) {
      return res.status(400).send("Missing code or state");
    }

    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");

    try {
      const oauth2Client = makeOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      await db.externalCalendarToken.upsert({
        where: {
          userId_provider: { userId: Number(userId), provider: "google" },
        },
        create: {
          userId: Number(userId),
          provider: "google",
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
        update: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });

      await importGoogleEvents(Number(userId), oauth2Client);

      return res.send(`
        <html>
          <head>
            <meta http-equiv="Cross-Origin-Opener-Policy" content="unsafe-none">
          </head>
          <body>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              } catch (e) {
                window.location.href = '/';
              }
            </script>
            <p>Connected! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("Google OAuth callback error:", err);
      return res.status(500).send("OAuth error — please try again.");
    }
  });

  // ── POST /api/google-calendar/sync ───────────────────────────────────────
  router.post("/sync", async (req: Request, res: Response) => {
    const userId = Number(req.body.userId || req.headers["x-user-id"]);
    if (!userId) return res.status(400).json({ message: "userId required" });

    try {
      const tokenRow = await db.externalCalendarToken.findUnique({
        where: { userId_provider: { userId, provider: "google" } },
      });

      if (!tokenRow) {
        return res
          .status(404)
          .json({ message: "Google account not connected" });
      }

      const oauth2Client = makeOAuth2Client();
      oauth2Client.setCredentials({
        access_token: tokenRow.accessToken,
        refresh_token: tokenRow.refreshToken ?? undefined,
        expiry_date: tokenRow.expiresAt?.getTime(),
      });

      oauth2Client.on("tokens", async (newTokens: Credentials) => {
        await db.externalCalendarToken.update({
          where: { userId_provider: { userId, provider: "google" } },
          data: {
            accessToken: newTokens.access_token ?? tokenRow.accessToken,
            expiresAt: newTokens.expiry_date
              ? new Date(newTokens.expiry_date)
              : tokenRow.expiresAt,
          },
        });
      });

      const count = await importGoogleEvents(userId, oauth2Client);
      return res.json({ success: true, imported: count });
    } catch (err) {
      console.error("Google sync error:", err);
      return res.status(500).json({ message: "Sync failed" });
    }
  });

  // ── DELETE /api/google-calendar/disconnect ───────────────────────────────
  router.delete("/disconnect", async (req: Request, res: Response) => {
    const userId = Number(req.body.userId || req.headers["x-user-id"]);
    if (!userId) return res.status(400).json({ message: "userId required" });

    try {
      const tokenRow = await db.externalCalendarToken.findUnique({
        where: { userId_provider: { userId, provider: "google" } },
      });

      if (tokenRow) {
        const oauth2Client = makeOAuth2Client();
        try {
          await oauth2Client.revokeToken(tokenRow.accessToken);
        } catch {
        }
      }

      await db.externalCalendarToken.deleteMany({
        where: { userId, provider: "google" },
      });
      await deleteImportedEventsBySource(userId, "google");
      return res.json({ success: true });
    } catch (err) {
      console.error("Google disconnect error:", err);
      return res.status(500).json({ message: "Disconnect failed" });
    }
  });

  // ── GET /api/google-calendar/status ──────────────────────────────────────
  router.get("/status", async (req: Request, res: Response) => {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ message: "userId required" });

    const tokenRow = await db.externalCalendarToken.findUnique({
      where: { userId_provider: { userId, provider: "google" } },
    });

    return res.json({ connected: !!tokenRow });
  });

  return router;
}

// ── Import logic ──────────────────────────────────────────────────────────────
async function importGoogleEvents(
  userId: number,
  auth: InstanceType<typeof google.auth.OAuth2>,
): Promise<number> {
  const calendar = google.calendar({ version: "v3", auth });

  const calListRes = await calendar.calendarList.list({
    minAccessRole: "reader",
  });
  const calendarList = calListRes.data.items ?? [];

  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );
  const oneYearAhead = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate(),
  );

  const eventsToUpsert: Parameters<typeof upsertImportedEvents>[1] = [];

  for (const cal of calendarList) {
    if (!cal.id) continue;

    try {
      let pageToken: string | undefined;
      do {
        const eventsRes = await calendar.events.list({
          calendarId: cal.id,
          timeMin: oneYearAgo.toISOString(),
          timeMax: oneYearAhead.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 250,
          pageToken,
        });

        const items = eventsRes.data.items ?? [];
        for (const ev of items) {
          if (!ev.id || ev.status === "cancelled") continue;

          const startRaw = ev.start?.dateTime ?? ev.start?.date;
          const endRaw = ev.end?.dateTime ?? ev.end?.date;
          if (!startRaw || !endRaw) continue;

          const startDate = new Date(startRaw);
          const endDate = new Date(endRaw);
          const startHour = startDate.getHours() + startDate.getMinutes() / 60;
          const endHour = endDate.getHours() + endDate.getMinutes() / 60;
          const eventDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
          );

          eventsToUpsert.push({
            externalId: ev.id,
            source: "google",
            title: ev.summary ?? "(No title)",
            date: eventDate,
            startHour,
            endHour: endHour <= startHour ? startHour + 1 : endHour,
            location: ev.location ?? null,
            description: ev.description ?? null,
            attendees: (ev.attendees ?? [])
              .map((a: { email?: string | null }) => a.email)
              .filter(Boolean) as string[],
            videoconferencing: ev.hangoutLink ?? null,
            color: cal.backgroundColor ?? "#4285F4",
            calendarName: cal.summary ?? "Google Calendar",
          });
        }

        pageToken = eventsRes.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (calErr) {
      console.error(`Failed to fetch events from calendar ${cal.id}:`, calErr);
    }
  }

  await upsertImportedEvents(userId, eventsToUpsert);
  return eventsToUpsert.length;
}