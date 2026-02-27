import { NextRequest, NextResponse } from "next/server";
import { generateThumbnailUrl } from "@/lib/thumbnail/service";

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab") ?? undefined;
  const channel = request.nextUrl.searchParams.get("channel") ?? undefined;
  const title = request.nextUrl.searchParams.get("title") ?? undefined;
  const summary = request.nextUrl.searchParams.get("summary") ?? undefined;
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;

  const result = await generateThumbnailUrl({ tab, channel, title, summary, projectId });
  if (!result) {
    return NextResponse.json({ url: null, reason: "provider_unavailable" });
  }

  return NextResponse.json(result);
}
