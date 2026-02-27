import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { uploadThumbnail } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    await getAuthFromRequest(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }

    const uploaded = await uploadThumbnail(file);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
