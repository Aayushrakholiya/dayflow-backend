/*  
*  FILE          : microsoftcalendar.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Handles Microsoft Calendar OAuth2 authentication and event synchronization.
*/ 

import express, { Request, Response } from "express";
import {
  upsertImportedEvents,
  deleteImportedEventsBySource,
} from "./Importedevents";
import { db } from "./db";

// ── Constants ─────────────────────────────────────────────────────────────────
const TENANT        = "common";
const AUTHORITY     = `https://login.microsoftonline.com/${TENANT}`;
const GRAPH_API     = "https://graph.microsoft.com/v1.0";
const SCOPES        = ["Calendars.Read", "User.Read", "offline_access"];
const SCOPE_STRING  = SCOPES.join(" ");

function getClientId()     { return process.env.MICROSOFT_CLIENT_ID!; }
function getClientSecret() { return process.env.MICROSOFT_CLIENT_SECRET!; }
function getRedirectUri()  { return process.env.MICROSOFT_REDIRECT_URI!; }

// ── OAuth helpers ─────────────────────────────────────────────────────────────

function buildAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id:     getClientId(),
    response_type: "code",
    redirect_uri:  getRedirectUri(),
    scope:         SCOPE_STRING,
    state:         userId,
    prompt:        "consent",
    access_type:   "offline",
  });
  return `${AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     getClientId(),
      client_secret: getClientSecret(),
      redirect_uri:  getRedirectUri(),
      grant_type:    "authorization_code",
      code,
      scope:         SCOPE_STRING,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error_description ?? "Token exchange failed");
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     getClientId(),
      client_secret: getClientSecret(),
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      scope:         SCOPE_STRING,
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

// ── Get a valid access token (refresh if needed) ──────────────────────────────
async function getValidAccessToken(userId: number): Promise<string> {
  const tokenRow = await db.externalCalendarToken.findUnique({
    where: { userId_provider: { userId, provider: "microsoft" } },
  });
  if (!tokenRow) throw new Error("Microsoft account not connected");

  const isExpired = tokenRow.expiresAt && tokenRow.expiresAt.getTime() < Date.now() + 60_000;

  if (isExpired && tokenRow.refreshToken) {
    const refreshed = await refreshAccessToken(tokenRow.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await db.externalCalendarToken.update({
      where: { userId_provider: { userId, provider: "microsoft" } },
      data: {
        accessToken:  refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? tokenRow.refreshToken,
        expiresAt,
      },
    });
    return refreshed.access_token;
  }

  return tokenRow.accessToken;
}

// ── Graph API fetch helper ────────────────────────────────────────────────────
async function graphGet(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${GRAPH_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `Graph API error on ${path}`);
  }
  return res.json();
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function createMicrosoftCalendarRouter() {
  const router = express.Router();

  // ── GET /api/microsoft-calendar/auth-url ─────────────────────────────────
  router.get("/auth-url", (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId required" });
    return res.json({ url: buildAuthUrl(userId) });
  });

  // ── GET /api/microsoft-calendar/callback ─────────────────────────────────
  router.get("/callback", async (req: Request, res: Response) => {
    const code     = req.query.code  as string;
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
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");

    try {
      const tokens    = await exchangeCodeForTokens(code);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await db.externalCalendarToken.upsert({
        where:  { userId_provider: { userId: Number(userId), provider: "microsoft" } },
        create: {
          userId:       Number(userId),
          provider:     "microsoft",
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt,
        },
        update: {
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt,
        },
      });

      await importMicrosoftEvents(Number(userId), tokens.access_token);

      return res.send(`
        <html>
          <head>
            <meta http-equiv="Cross-Origin-Opener-Policy" content="unsafe-none">
          </head>
          <body>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'MICROSOFT_CALENDAR_CONNECTED' }, '*');
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
      console.error("Microsoft OAuth callback error:", err);
      return res.status(500).send("OAuth error — please try again.");
    }
  });

  // ── POST /api/microsoft-calendar/sync ────────────────────────────────────
  router.post("/sync", async (req: Request, res: Response) => {
    const userId = Number(req.body.userId || req.headers["x-user-id"]);
    if (!userId) return res.status(400).json({ message: "userId required" });

    try {
      const accessToken = await getValidAccessToken(userId);
      const count       = await importMicrosoftEvents(userId, accessToken);
      return res.json({ success: true, imported: count });
    } catch (err) {
      console.error("Microsoft sync error:", err);
      return res.status(500).json({ message: "Sync failed" });
    }
  });

  // ── DELETE /api/microsoft-calendar/disconnect ─────────────────────────────
  router.delete("/disconnect", async (req: Request, res: Response) => {
    const userId = Number(req.body.userId || req.headers["x-user-id"]);
    if (!userId) return res.status(400).json({ message: "userId required" });

    try {
      await db.externalCalendarToken.deleteMany({
        where: { userId, provider: "microsoft" },
      });
      await deleteImportedEventsBySource(userId, "microsoft");
      return res.json({ success: true });
    } catch (err) {
      console.error("Microsoft disconnect error:", err);
      return res.status(500).json({ message: "Disconnect failed" });
    }
  });

  // ── GET /api/microsoft-calendar/status ───────────────────────────────────
  router.get("/status", async (req: Request, res: Response) => {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ message: "userId required" });

    const tokenRow = await db.externalCalendarToken.findUnique({
      where: { userId_provider: { userId, provider: "microsoft" } },
    });

    return res.json({ connected: !!tokenRow });
  });

  return router;
}

// ── Import logic ──────────────────────────────────────────────────────────────
async function importMicrosoftEvents(
  userId: number,
  accessToken: string,
): Promise<number> {
  const now          = new Date();
  const oneYearAgo   = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
  const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

  const calData   = await graphGet("/me/calendars", accessToken);
  const calendars = calData.value ?? [];

  const eventsToUpsert: Parameters<typeof upsertImportedEvents>[1] = [];

  for (const cal of calendars) {
    try {
      let url: string | null =
        `/me/calendars/${cal.id}/calendarView?startDateTime=${oneYearAgo}&endDateTime=${oneYearAhead}&$top=250&$select=id,subject,start,end,location,bodyPreview,attendees,onlineMeeting,isAllDay`;

      while (url) {
        const data  = await graphGet(url.startsWith("/me") ? url : url.replace(GRAPH_API, ""), accessToken);
        const items = data.value ?? [];

        for (const ev of items) {
          if (!ev.id || ev.isCancelled) continue;

          const startRaw = ev.start?.dateTime;
          const endRaw   = ev.end?.dateTime;
          if (!startRaw || !endRaw) continue;

          const startDate = new Date(startRaw + (startRaw.endsWith("Z") ? "" : "Z"));
          const endDate   = new Date(endRaw   + (endRaw.endsWith("Z")   ? "" : "Z"));

          const startHour = startDate.getHours() + startDate.getMinutes() / 60;
          const endHour   = endDate.getHours()   + endDate.getMinutes() / 60;
          const eventDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
          );

          const attendeeEmails = (ev.attendees ?? [])
            .map((a: any) => a.emailAddress?.address)
            .filter(Boolean) as string[];

          eventsToUpsert.push({
            externalId:        ev.id,
            source:            "microsoft",
            title:             ev.subject ?? "(No title)",
            date:              eventDate,
            startHour,
            endHour:           endHour <= startHour ? startHour + 1 : endHour,
            location:          ev.location?.displayName || null,
            description:       ev.bodyPreview || null,
            attendees:         attendeeEmails,
            videoconferencing: ev.onlineMeeting?.joinUrl ?? null,
            color:             cal.color !== "auto" ? msColorToHex(cal.color) : "#0078D4",
            calendarName:      cal.name ?? "Outlook Calendar",
          });
        }

        url = data["@odata.nextLink"]
          ? data["@odata.nextLink"].replace(GRAPH_API, "")
          : null;
      }
    } catch (calErr) {
      console.error(`Failed to fetch events from Microsoft calendar ${cal.id}:`, calErr);
    }
  }

  await upsertImportedEvents(userId, eventsToUpsert);
  return eventsToUpsert.length;
}

// ── Microsoft calendar color names → hex ──────────────────────────────────────
function msColorToHex(color: string): string {
  const map: Record<string, string> = {
    lightBlue:   "#5DA5D5",
    lightGreen:  "#51A351",
    lightOrange: "#E07A22",
    lightGray:   "#A0A0A0",
    lightYellow: "#D4C006",
    lightTeal:   "#009EB0",
    lightPink:   "#D4347C",
    lightBrown:  "#8B572A",
    lightRed:    "#CC3300",
    maxColor:    "#0078D4",
  };
  return map[color] ?? "#0078D4";
}