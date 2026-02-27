import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { uploadBoardAttachment } from "@/lib/storage";

const querySchema = z.object({
  slug: z.string().min(1).max(80),
});

export async function POST(request: NextRequest) {
  try {
    await getAuthFromRequest(request);
    const parsedQuery = querySchema.parse({
      slug: request.nextUrl.searchParams.get("slug"),
    });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }

    const uploaded = await uploadBoardAttachment(parsedQuery.slug, file);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
    }
    return jsonError(error);
  }
}
