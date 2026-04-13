/*  
*  FILE          : Eventinvite.ts 
*  PROJECT       : PROG3221 - capstone
*  PROGRAMMER    : Ayushkumar Rakholiya, Jal Shah, Darsh Patel and Virajsinh Solanki 
*  FIRST VERSION : 2026-02-01 
*  DESCRIPTION   : 
*    Sends DayFlow meeting invite emails to attendees via Brevo.
*/ 


import type { Express, Request, Response } from "express";

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatHour12(h: number): string {
  const total = Math.round(h * 60);
  const h24 = Math.floor(total / 60);
  const mins = total % 60;
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  const period = h24 < 12 ? "AM" : "PM";
  return `${hour}:${pad2(mins)} ${period}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Brevo sender ──────────────────────────────────────────────────────────────

async function sendInviteEmail(
  to: string,
  eventTitle: string,
  dateIso: string,
  startHour: number,
  endHour: number,
  location?: string,
  videoconferencing?: string,
  description?: string,
) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME ?? "DayFlow";

  if (!apiKey) throw new Error("Missing BREVO_API_KEY in environment.");
  if (!fromEmail) throw new Error("Missing EMAIL_FROM in environment.");

  const dateLabel = formatDate(dateIso);
  const timeLabel = `${formatHour12(startHour)} – ${formatHour12(endHour)}`;

  const locationRow = location
    ? `<tr>
         <td style="padding:6px 0;color:#6b7280;font-size:13px;width:90px;">📍 Location</td>
         <td style="padding:6px 0;font-size:13px;">${location}</td>
       </tr>`
    : "";

  const videoRow = videoconferencing
    ? `<tr>
         <td style="padding:6px 0;color:#6b7280;font-size:13px;">🎥 Video</td>
         <td style="padding:6px 0;font-size:13px;">
           <a href="${videoconferencing}" style="color:#f97316;">${videoconferencing}</a>
         </td>
       </tr>`
    : "";

  const descRow = description
    ? `<tr>
         <td style="padding:6px 0;color:#6b7280;font-size:13px;vertical-align:top;">📝 Notes</td>
         <td style="padding:6px 0;font-size:13px;">${description}</td>
       </tr>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#f97316;padding:24px 28px;">
        <h1 style="margin:0;color:#fff;font-size:20px;">📅 You've been invited to a meeting</h1>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 20px;font-size:22px;color:#111827;">${eventTitle}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:90px;">📆 Date</td>
            <td style="padding:6px 0;font-size:13px;">${dateLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">🕐 Time</td>
            <td style="padding:6px 0;font-size:13px;">${timeLabel}</td>
          </tr>
          ${locationRow}
          ${videoRow}
          ${descRow}
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
          This invite was sent via DayFlow. If you weren't expecting this, you can safely ignore it.
        </p>
      </div>
    </div>
  `;

  const text = [
    `You've been invited to: ${eventTitle}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    location ? `Location: ${location}` : "",
    videoconferencing ? `Video: ${videoconferencing}` : "",
    description ? `Notes: ${description}` : "",
    "",
    "This invite was sent via DayFlow.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject: `📅 Meeting invite: ${eventTitle}`,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as any;
    throw new Error(err.message ?? "Brevo send failed");
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerEventInviteRoutes(app: Express) {
  /**
   * POST /api/events/send-invites
   * Body: { eventTitle, date, startHour, endHour, attendees, location?, videoconferencing?, description? }
   */
  app.post("/api/events/send-invites", async (req: Request, res: Response) => {
    const {
      eventTitle,
      date,
      startHour,
      endHour,
      attendees,
      location,
      videoconferencing,
      description,
    } = req.body as {
      eventTitle?: string;
      date?: string;
      startHour?: number;
      endHour?: number;
      attendees?: string[];
      location?: string;
      videoconferencing?: string;
      description?: string;
    };

    if (!eventTitle || !date || startHour == null || endHour == null) {
      return res
        .status(400)
        .json({
          message:
            "Missing required fields: eventTitle, date, startHour, endHour",
        });
    }

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return res
        .status(200)
        .json({ message: "No attendees to notify", sent: 0 });
    }

    const results = await Promise.allSettled(
      attendees.map((email) =>
        sendInviteEmail(
          email,
          eventTitle,
          date,
          startHour,
          endHour,
          location,
          videoconferencing,
          description,
        ),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results
      .filter((r) => r.status === "rejected")
      .map((r, i) => {
        const reason = (r as PromiseRejectedResult).reason;
        console.error(
          `Failed to send invite to ${attendees[i]}:`,
          reason?.message ?? reason,
        );
        return attendees[i];
      });

    return res.status(200).json({
      message: `Invites sent: ${sent}/${attendees.length}`,
      sent,
      failed,
    });
  });
}
