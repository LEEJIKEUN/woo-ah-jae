import { NextResponse } from "next/server";
import { getMaintenanceState } from "@/lib/maintenance";

export async function GET() {
  const state = await getMaintenanceState();
  return NextResponse.json({
    status: state.status,
    lockAt: state.lockAt,
    messageKor: state.messageKor,
  });
}
