/**
 * 강좌 복제 스캐폴드 생성기.
 *
 *   npm run course:clone -- --id <새-강좌-id> --title "<새 강좌 제목>" [--from <원본-id>]
 *
 * 하는 일
 *  1) 원본 강좌(기본: 시드 강좌 ai-linalg)의 커리큘럼·메뉴 구성을 통째로 복제해
 *     src/lib/course/courses/<새-id>.ts 를 생성한다(내용까지 그대로, 편집 가능한 명시적 리터럴).
 *  2) src/lib/course/courses/index.ts 에 자동 등록한다.
 *  3) 새 강좌는 defaultStatus="private"(비공개) 이고, 수강생 목록(enrolled)은 비운다.
 *     게시글·댓글·멘토링·시험 등 모든 기록물은 새 강좌 id 기준으로 처음부터 비어 있다.
 *
 * 생성 후에는 VS Code 에서 <새-id>.ts 를 열어 내용을 새 강좌에 맞게 수정하고,
 * (원하면) 상태를 공개로 바꾼 뒤 커밋·배포하면 된다. 라이브 데이터에는 전혀 영향이 없다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COURSES, type Course } from "../src/lib/course/content";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const COURSES_DIR = path.join(ROOT, "src/lib/course/courses");
const INDEX_FILE = path.join(COURSES_DIR, "index.ts");

// ── 인자 파싱 ─────────────────────────────────────────────────
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { out[key] = next; i++; }
      else out[key] = "true";
    }
  }
  return out;
}

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// ── TS 소스 직렬화(명시적 리터럴) ────────────────────────────
function keyStr(k: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
}
function ser(v: unknown, ind: string): string {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "string") return JSON.stringify(v);
  if (t === "number" || t === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const inner = v.map((x) => ind + "  " + ser(x, ind + "  ")).join(",\n");
    return "[\n" + inner + "\n" + ind + "]";
  }
  if (t === "object") {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
    if (keys.length === 0) return "{}";
    const inner = keys.map((k) => ind + "  " + keyStr(k) + ": " + ser(obj[k], ind + "  ")).join(",\n");
    return "{\n" + inner + "\n" + ind + "}";
  }
  return "undefined";
}

// slug(kebab) → 안전한 식별자(camel). 숫자로 시작하면 course_ 접두.
function toIdent(slug: string): string {
  const camel = slug.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""));
  return /^[a-zA-Z_$]/.test(camel) ? camel : "course_" + camel;
}

// ── 메인 ─────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const id = (args.id ?? "").trim();
const fromId = (args.from ?? COURSES[0]?.id ?? "").trim();
const title = (args.title ?? "").trim();

if (!id || id === "true") {
  die('새 강좌 id 가 필요합니다.  예) npm run course:clone -- --id physics-101 --title "고교 물리 입문"');
}
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) {
  die(`강좌 id 형식이 올바르지 않습니다: "${id}"  (소문자·숫자·하이픈, 2~41자, 예: physics-101)`);
}
if (COURSES.some((c) => c.id === id)) {
  die(`이미 존재하는 강좌 id 입니다: "${id}"`);
}
const outFile = path.join(COURSES_DIR, `${id}.ts`);
if (fs.existsSync(outFile)) {
  die(`이미 파일이 존재합니다: ${path.relative(ROOT, outFile)}`);
}
const template = COURSES.find((c) => c.id === fromId);
if (!template) {
  die(`원본 강좌를 찾을 수 없습니다: "${fromId}"  (사용 가능: ${COURSES.map((c) => c.id).join(", ")})`);
}

// 깊은 복제 후 새 강좌에 맞게 최소 조정(내용은 통째로 유지).
const clone = structuredClone(template) as Course;
clone.id = id;
clone.code = id.replace(/-/g, "_");
if (title && title !== "true") clone.title = title;
clone.enrolled = []; // 수강생(기록물) 제외 — 새 강좌는 처음부터 비어 있음
clone.defaultStatus = "private"; // 비공개 — 관리자에게만 보임

const ident = toIdent(id);
const stamp = new Date().toISOString().slice(0, 10);

const header = `import type { Course } from "../content";

/**
 * 강좌: ${clone.title}
 * 복제 생성 ${stamp} — 원본 "${template.title}" (${template.id}) 의 구성을 그대로 복제.
 *
 * ★ 시드 강좌와 완전히 동일한 메뉴·기능(게시판·멘토링·시험·현황·출석·강의)을 갖습니다.
 * ★ 기본 상태는 비공개(private) — 관리자에게만 보입니다. 공개하려면 관리자 화면에서 상태를 바꾸거나
 *    아래 defaultStatus 를 "open" 등으로 변경하세요.
 * ★ 아래 내용은 원본에서 복사된 것이므로, 새 강좌에 맞게 자유롭게 수정하세요.
 *    - 주차 날짜(weekStart/weekEnd/scheduleLabel/periodLabel), 세션 제목·본문
 *    - 강의자료(materials.href) 경로는 아직 원본(${template.id})을 가리킵니다 → 새 자료로 교체 필요
 */
export const ${ident}: Course = `;

fs.writeFileSync(outFile, header + ser(clone, "") + ";\n", "utf8");

// index.ts 등록(마커 기준 삽입).
let index = fs.readFileSync(INDEX_FILE, "utf8");
const importMarker = "// clone:imports";
const registerMarker = "// clone:register";
if (!index.includes(importMarker) || !index.includes(registerMarker)) {
  die(`index.ts 의 등록 마커(${importMarker} / ${registerMarker})를 찾지 못했습니다. 수동 등록이 필요합니다.`);
}
index = index.replace(importMarker, `import { ${ident} } from "./${id}";\n${importMarker}`);
index = index.replace(registerMarker, `${ident},\n  ${registerMarker}`);
fs.writeFileSync(INDEX_FILE, index, "utf8");

console.log(`\n✓ 새 강좌 생성 완료: ${clone.title}  (id: ${id})`);
console.log(`  · 파일:  ${path.relative(ROOT, outFile)}`);
console.log(`  · 등록:  ${path.relative(ROOT, INDEX_FILE)}  (EXTRA_COURSES 에 ${ident} 추가)`);
console.log(`  · 상태:  비공개(private) — 관리자에게만 보임`);
console.log(`  · 기록물: 없음(수강생·게시글·댓글·멘토링·시험은 새 id 기준 빈 상태)`);
console.log(`\n다음 단계`);
console.log(`  1) VS Code 에서 ${path.relative(ROOT, outFile)} 를 열어 내용을 새 강좌에 맞게 수정`);
console.log(`  2) 강의자료(materials.href) 경로를 새 자료로 교체 (현재 ${template.id} 를 가리킴)`);
console.log(`  3) npm run build 로 확인 → 커밋 → npm run release:allow → git push origin main`);
console.log(`  4) 관리자로 접속해 강좌 상태를 '접수중' 등으로 변경하면 공개됩니다.\n`);
