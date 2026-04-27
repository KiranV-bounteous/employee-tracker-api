import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const VALID_RESPONSES = new Set(["Safe", "Need Help", "Unable to Respond"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, alertId, responseText, timestamp, latitude, longitude } = body;

    if (!employeeId || typeof employeeId !== "string" || employeeId.trim() === "") {
      return NextResponse.json(
        { success: false, error: "employeeId is required" },
        { status: 400 }
      );
    }

    if (!alertId || typeof alertId !== "number") {
      return NextResponse.json(
        { success: false, error: "alertId is required and must be a number" },
        { status: 400 }
      );
    }

    if (!responseText || !VALID_RESPONSES.has(responseText)) {
      return NextResponse.json(
        { success: false, error: "responseText must be one of: Safe, Need Help, Unable to Respond" },
        { status: 400 }
      );
    }

    if (!timestamp || isNaN(Date.parse(timestamp))) {
      return NextResponse.json(
        { success: false, error: "timestamp must be a valid ISO 8601 date string" },
        { status: 400 }
      );
    }

    if (latitude !== null && latitude !== undefined) {
      if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { success: false, error: "latitude must be a number between -90 and 90" },
          { status: 400 }
        );
      }
    }

    if (longitude !== null && longitude !== undefined) {
      if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { success: false, error: "longitude must be a number between -180 and 180" },
          { status: 400 }
        );
      }
    }

    // Verify alert exists, belongs to employee; fetch sla_deadline + event_id + created_at for sync write
    const alert = await sql`
      SELECT id, sla_deadline, event_id, created_at FROM alerts
      WHERE id = ${alertId} AND emp_id = ${employeeId.trim()}
      LIMIT 1
    `;

    if (alert.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Alert not found or not assigned to this employee" },
        { status: 404 }
      );
    }

    const slaDeadline = alert.rows[0].sla_deadline as Date;
    const respondedAt = new Date(timestamp);
    // Compute server-side: response is late if it arrived after the SLA deadline
    const isLate = respondedAt > slaDeadline;
    const isWithinSla = !isLate;
    const responseTimeSeconds = Math.max(
      0,
      Math.floor((respondedAt.getTime() - new Date(alert.rows[0].created_at ?? respondedAt).getTime()) / 1000)
    );

    // Map mobile-friendly text to canonical sync type
    const responseTypeMap: Record<string, string> = {
      "Safe": "safe",
      "Need Help": "need_help",
      "Unable to Respond": "unable_to_respond",
    };
    const responseType = responseTypeMap[responseText];
    const eventId = alert.rows[0].event_id ?? null;

    const lat = latitude ?? null;
    const lng = longitude ?? null;

    // Write to legacy alert_responses (for backward compat with existing reports)
    const legacy = await sql`
      INSERT INTO alert_responses (alert_id, emp_id, response_text, responded_at, latitude, longitude, is_late)
      VALUES (
        ${alertId},
        ${employeeId.trim()},
        ${responseText},
        ${timestamp},
        ${lat},
        ${lng},
        ${isLate}
      )
      RETURNING
        id,
        alert_id,
        emp_id,
        response_text,
        to_char(responded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS responded_at,
        latitude,
        longitude,
        is_late,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
    `;

    // ALSO write to responses table (Spring sync source) — best effort, don't fail mobile if this errors
    if (eventId) {
      try {
        await sql`
          INSERT INTO responses (
            alert_id, event_id, emp_id, response_type, response_lat, response_lng,
            responded_at, is_within_sla, is_late, response_time_seconds, synced
          ) VALUES (
            ${alertId}, ${eventId}, ${employeeId.trim()}, ${responseType},
            ${lat}, ${lng}, ${timestamp},
            ${isWithinSla}, ${isLate}, ${responseTimeSeconds}, FALSE
          )
        `;
      } catch (e) {
        console.error("[POST /api/responses] failed to write to responses table:", e);
      }
    }

    return NextResponse.json(
      { success: true, data: legacy.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[${new Date().toISOString()}] POST /api/responses error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
