"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet } from "lucide-react";

type Standard = { id?: string; area: string; code: string; content: string };

const BROWN = "#8C6E59";
const INK = "#2C2823";
const SUB = "#8A8479";
const LINE = "#E4DBC7";
const CARD = "#EFEBE1";
const PANEL = "#FBF8F2";

/** 헤더 이름을 유연하게 매핑 */
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.replace(/\s/g, "").toLowerCase();
    if (keys.some((want) => norm.includes(want))) {
      const v = row[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return "";
}

export default function AchievementStandardsManager({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/achievement-standards`, { cache: "no-store" });
      const d = (await res.json()) as { items?: Standard[]; error?: string };
      if (res.ok) setItems(d.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadSample() {
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const rows = [
        { 영역: "선형대수의 기초", 코드: "[AI수학-01-01]", 성취기준: "벡터와 행렬의 개념을 이해하고 실생활 문제로 표현할 수 있다." },
        { 영역: "선형방정식", 코드: "[AI수학-01-02]", 성취기준: "선형방정식과 선형시스템을 이해하고 해를 구할 수 있다." },
        { 영역: "고유값과 고유벡터", 코드: "[AI수학-02-03]", 성취기준: "고유값·고유벡터의 의미를 설명하고 응용할 수 있다." },
      ];
      const ws = XLSX.utils.json_to_sheet(rows, { header: ["영역", "코드", "성취기준"] });
      ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 60 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "성취기준");
      XLSX.writeFile(wb, "성취기준_샘플.xlsx");
    } catch {
      setError("샘플 파일 생성에 실패했습니다.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const parsed: Standard[] = json
        .map((r) => ({
          area: pick(r, ["영역", "area", "과목", "단원"]),
          code: pick(r, ["코드", "code", "번호"]),
          content: pick(r, ["성취기준", "내용", "content", "기준"]),
        }))
        .filter((r) => r.content || r.code);

      if (!parsed.length) {
        setError("성취기준 데이터를 찾지 못했습니다. 샘플 양식(영역/코드/성취기준)을 확인해 주세요.");
        return;
      }

      const res = await fetch(`/api/courses/${courseId}/achievement-standards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed }),
      });
      const d = (await res.json()) as { ok?: boolean; count?: number; error?: string };
      if (!res.ok) {
        setError(d.error ?? "업로드에 실패했습니다.");
        return;
      }
      setMsg(`성취기준 ${d.count ?? parsed.length}개를 등록했습니다. 학생 탐구보고서에 바로 반영됩니다.`);
      await load();
    } catch {
      setError("엑셀 파일을 읽지 못했습니다. .xlsx 형식인지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-[14px] bg-white" style={{ border: `1px solid ${CARD}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4" style={{ borderColor: CARD }}>
        <div>
          <h2 className="text-[17px] font-bold" style={{ color: INK }}>성취기준 관리</h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: SUB }}>엑셀로 성취기준을 등록하면 학생이 탐구보고서에서 선택할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void downloadSample()} className="inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: LINE, color: BROWN }}>
            <Download size={15} /> 샘플 엑셀
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: BROWN }}>
            <Upload size={15} /> {busy ? "업로드 중…" : "엑셀 업로드"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
        </div>
      </div>

      <div className="px-5 py-4">
        {msg ? <p className="mb-3 rounded-[8px] border px-3 py-2 text-[12.5px]" style={{ borderColor: "#BFD8C6", background: "#EFF6F1", color: "#3E7E5B" }}>{msg}</p> : null}
        {error ? <p className="mb-3 rounded-[8px] border px-3 py-2 text-[12.5px]" style={{ borderColor: "#E6C4C4", background: "#FBEFEF", color: "#B4544B" }}>{error}</p> : null}

        {loading ? (
          <p className="py-6 text-center text-[13px]" style={{ color: SUB }}>불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileSpreadsheet size={28} style={{ color: LINE }} />
            <p className="text-[13px]" style={{ color: SUB }}>등록된 성취기준이 없습니다. 샘플 양식을 내려받아 작성 후 업로드하세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]" style={{ color: INK }}>
              <thead>
                <tr style={{ background: PANEL }}>
                  <th className="w-10 whitespace-nowrap px-3 py-2.5 text-[11.5px] font-bold" style={{ color: SUB }}>#</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-[11.5px] font-bold" style={{ color: SUB }}>영역</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-[11.5px] font-bold" style={{ color: SUB }}>코드</th>
                  <th className="px-3 py-2.5 text-[11.5px] font-bold" style={{ color: SUB }}>성취기준</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id ?? i} className="border-t" style={{ borderColor: CARD }}>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: SUB }}>{i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{it.area || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: BROWN }}>{it.code || "-"}</td>
                    <td className="px-3 py-2.5 leading-6">{it.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px]" style={{ color: SUB }}>총 {items.length}개 · 새로 업로드하면 기존 목록은 교체됩니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
