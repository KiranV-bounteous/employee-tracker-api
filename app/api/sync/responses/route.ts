import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const syncedParam = searchParams.get("synced");
    const limit  = Math.min(Math.max(1, parseInt(searchParams.get("limit")  || "500", 10)), 1000);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0",   10));

    const conds: string[] = [];
    const params: any[] = [];
    if (syncedParam === "true" || syncedParam === "false") {
      params.push(syncedParam === "true");
      conds.push(`synced = $${params.length}`);
    }
    const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const totalRes = await sql.query(
      `SELECT COUNT(*)::int AS total FROM responses ${whereSql}`,
      params
    );
    const total: number = totalRes.rows[0]?.total ?? 0;

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const result = await sql.query(
      `SELECT
         id,
         alert_id,
         event_id,
         emp_id,
         response_type,
         response_lat,
         response_lng,
         to_char(responded_at AT TIME ZONE 'UTC', ${ISO}) AS responded_at,
         is_within_sla,
         is_late,
         response_time_seconds,
         to_char(created_at AT TIME ZONE 'UTC', ${ISO}) AS created_at
       FROM responses
       ${whereSql}
       ORDER BY id
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + result.rows.length < total,
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] GET /api/sync/responses error:`, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
