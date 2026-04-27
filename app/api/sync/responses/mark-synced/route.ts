import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const result = await sql.query(
      `UPDATE responses SET synced = TRUE WHERE id = ANY($1::int[])`,
      [ids]
    );

    return NextResponse.json({ success: true, updated: result.rowCount ?? 0 });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] PATCH /api/sync/responses/mark-synced error:`, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
