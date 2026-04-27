import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const emp_id = request.nextUrl.searchParams.get("emp_id");

    if (!emp_id || emp_id.trim() === "") {
      return NextResponse.json(
        { success: false, error: "emp_id query parameter is required" },
        { status: 400 }
      );
    }

    // Mobile app stores token in sessions.fcm_token (via /api/session/register-token).
    // Newer flow may also use device_tokens. Check both, preferring whichever has a value.
    let fcm_token: string | null = null;

    // 1. Active session token (most common)
    try {
      const sessions = await sql`
        SELECT fcm_token
        FROM sessions
        WHERE emp_id = ${emp_id}
          AND is_active = true
          AND fcm_token IS NOT NULL
        ORDER BY check_in_time DESC
        LIMIT 1
      `;
      if (sessions.rows.length > 0 && sessions.rows[0].fcm_token) {
        fcm_token = sessions.rows[0].fcm_token;
      }
    } catch {
      // sessions table may not have fcm_token column yet; ignore and try device_tokens
    }

    // 2. Fallback to device_tokens table if present
    if (!fcm_token) {
      try {
        const dev = await sql`
          SELECT fcm_token
          FROM device_tokens
          WHERE emp_id = ${emp_id} AND is_active = TRUE
          ORDER BY updated_at DESC
          LIMIT 1
        `;
        if (dev.rows.length > 0 && dev.rows[0].fcm_token) {
          fcm_token = dev.rows[0].fcm_token;
        }
      } catch {
        // device_tokens table may not exist yet; that's fine
      }
    }

    return NextResponse.json({ success: true, fcm_token });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] GET /api/session/fcm-token error:`, error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
