import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status        = searchParams.get("status");
    const createdSince  = searchParams.get("created_since");
    const limit  = Math.min(Math.max(1, parseInt(searchParams.get("limit")  || "100", 10)), 500);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0",   10));

    const conds: string[] = [];
    const params: any[] = [];
    if (status)       { params.push(status);       conds.push(`status = $${params.length}`); }
    if (createdSince) { params.push(createdSince); conds.push(`created_at >= $${params.length}`); }

    const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const totalRes = await sql.query(
      `SELECT COUNT(*)::int AS total FROM events ${whereSql}`,
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
         title,
         description,
         event_type,
         severity,
         area_type,
         affected_lat,
         affected_lng,
         affected_radius_meters,
         polygon_coordinates,
         response_deadline_seconds,
         status,
         trigger_source,
         created_by,
         to_char(activated_at AT TIME ZONE 'UTC', ${ISO}) AS activated_at,
         to_char(closed_at    AT TIME ZONE 'UTC', ${ISO}) AS closed_at,
         to_char(created_at   AT TIME ZONE 'UTC', ${ISO}) AS created_at
       FROM events
       ${whereSql}
       ORDER BY created_at DESC
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
    console.error(`[${new Date().toISOString()}] GET /api/sync/events error:`, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
