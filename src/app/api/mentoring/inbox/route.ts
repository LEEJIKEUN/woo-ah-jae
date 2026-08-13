import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { getInbox } from "@/lib/mentoring-inbox";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    const data = await getInbox({ userId: auth.userId, role: auth.role });
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
