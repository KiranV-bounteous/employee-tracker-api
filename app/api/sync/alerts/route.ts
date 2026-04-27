import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const createdSince = searchParams.get("created_since");
    const limit  = Math.min(Math.max(1, parseInt(searchParams.get("limit")  || "500", 10)), 1000);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0",   10));

    const conds: string[] = ["event_id IS NOT NULL"];
    const params: any[] = [];
    if (createdSince) { params.push(createdSince); conds.push(`created_at >= $${params.length}`); }
    const whereSql = `WHERE ${conds.join(" AND ")}`;

    const totalRes = await sql.query(
      `SELECT COUNT(*)::int AS total FROM alerts ${whereSql}`,
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
         event_id,
         emp_id,
         delivery_status,
         to_char(response_deadline_at AT TIME ZONE 'UTC', ${ISO}) AS response_deadline_at,
         to_char(push_sent_at         AT TIME ZONE 'UTC', ${ISO}) AS push_sent_at,
         to_char(created_at           AT TIME ZONE 'UTC', ${ISO}) AS created_at
       FROM alerts
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
    console.error(`[${new Date().toISOString()}] GET /api/sync/alerts error:`, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
