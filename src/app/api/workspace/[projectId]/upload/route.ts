import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest, jsonError } from "@/lib/guards";
import { requireTeamMember } from "@/lib/permissions";
import { uploadWorkspaceFile } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await getAuthFromRequest(request);
    const { projectId } = await params;
    await requireTeamMember(projectId, auth.userId, auth.role);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }

    const uploaded = await uploadWorkspaceFile(projectId, file);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
