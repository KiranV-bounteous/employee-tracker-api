import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit  = Math.min(Math.max(1, parseInt(searchParams.get("limit")  || "500", 10)), 1000);
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0",   10));

    const totalRes = await sql`SELECT COUNT(*)::int AS total FROM employees`;
    const total: number = totalRes.rows[0]?.total ?? 0;

    const result = await sql`
      SELECT
        id,
        emp_id,
        name,
        email,
        phone,
        department,
        designation,
        manager_emp_id,
        role,
        is_active,
        to_char(created_at AT TIME ZONE 'UTC', ${ISO}) AS created_at,
        to_char(updated_at AT TIME ZONE 'UTC', ${ISO}) AS updated_at
      FROM employees
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `;

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
    console.error(`[${new Date().toISOString()}] GET /api/sync/employees error:`, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
