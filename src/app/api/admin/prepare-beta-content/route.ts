import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAdmin } from "@/lib/guards";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const bodySchema = z.object({
  confirm: z.literal("RUN_PREPARE_BETA_CONTENT"),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = bodySchema.parse(await request.json());
    if (body.confirm !== "RUN_PREPARE_BETA_CONTENT") {
      return NextResponse.json({ error: "Invalid confirm token" }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "prepare-beta-content.mjs");
    const result = await execFileAsync(process.execPath, [scriptPath], {
      env: process.env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 4,
    });

    return NextResponse.json({
      ok: true,
      stdout: result.stdout?.trim() ?? "",
      stderr: result.stderr?.trim() ?? "",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return jsonError(error);
  }
}
