import { NextRequest, NextResponse } from "next/server";
import { OVERSEAS_KOREAN_SCHOOLS } from "@/lib/signup-options";

type School = { name: string; sub: string };

type NeisRow = { SCHUL_NM?: string; SCHUL_KND_SC_NM?: string; LCTN_SC_NM?: string };
type NeisResp = { schoolInfo?: [unknown, { row?: NeisRow[] }] };

const NEIS_ENDPOINT = "https://open.neis.go.kr/hub/schoolInfo";

/** 학교 검색: 국내 중·고등학교(NEIS) + 재외한국학교(저장 목록). GET /api/schools?q= */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ schools: [] });

  // 재외한국학교 (원래 저장해 둔 목록)
  const overseas: School[] = OVERSEAS_KOREAN_SCHOOLS.filter((s) => s.includes(q)).map((s) => ({
    name: s,
    sub: "재외한국학교",
  }));

  // 국내 중·고등학교 (NEIS 오픈API — 키 없이 동작, 있으면 KEY 사용)
  let domestic: School[] = [];
  try {
    const params = new URLSearchParams({ Type: "json", pIndex: "1", pSize: "100", SCHUL_NM: q });
    const key = process.env.NEIS_API_KEY;
    if (key) params.set("KEY", key);

    const res = await fetch(`${NEIS_ENDPOINT}?${params.toString()}`, {
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const json = (await res.json()) as NeisResp;
      const rows = json.schoolInfo?.[1]?.row ?? [];
      domestic = rows
        .filter((r) => {
          const kind = String(r.SCHUL_KND_SC_NM ?? "");
          return kind.includes("중학교") || kind.includes("고등학교");
        })
        .map((r) => ({
          name: String(r.SCHUL_NM ?? ""),
          sub: [r.LCTN_SC_NM, r.SCHUL_KND_SC_NM].filter(Boolean).join(" · "),
        }));
    }
  } catch {
    // NEIS 실패 시 재외한국학교 결과만 반환
  }

  // 병합 + 중복 제거
  const seen = new Set<string>();
  const schools: School[] = [];
  for (const s of [...overseas, ...domestic]) {
    const dedupeKey = `${s.name}|${s.sub}`;
    if (!s.name || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    schools.push(s);
    if (schools.length >= 25) break;
  }

  return NextResponse.json({ schools });
}
