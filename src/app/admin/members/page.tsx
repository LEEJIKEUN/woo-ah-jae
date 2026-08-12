"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import { formatKstDate } from "@/lib/date-format";

type MemberItem = {
  id: string;
  email: string;
  realName: string | null;
  role: "STUDENT" | "FACILITATOR" | "PARENT" | "ADMIN";
  schoolName: string | null;
  grade: string | null;
  residenceCountry: string | null;
  createdAt: string;
};

const ROLE_KO: Record<MemberItem["role"], string> = {
  ADMIN: "관리자",
  FACILITATOR: "퍼실리테이터",
  PARENT: "학부모",
  STUDENT: "학생",
};

type SortKey = "realName" | "email" | "role" | "schoolName" | "grade" | "residenceCountry" | "createdAt";
type SortDirection = "asc" | "desc";
type ColumnFilterKey = "role" | "schoolName" | "grade" | "residenceCountry";

function compactCountry(value: string | null) {
  if (!value) return "-";
  const raw = value.trim();
  if (!raw) return "-";
  if (raw.length <= 3) return raw.toUpperCase();
  return raw.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || raw.slice(0, 3).toUpperCase();
}

export default function AdminMembersPage() {
  const [items, setItems] = useState<MemberItem[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnFilters, setColumnFilters] = useState<Record<ColumnFilterKey, string[]>>({
    role: [],
    schoolName: [],
    grade: [],
    residenceCountry: [],
  });
  const [activeFilterKey, setActiveFilterKey] = useState<ColumnFilterKey | null>(null);
  const [draftFilterValues, setDraftFilterValues] = useState<string[]>([]);
  const [filterOptionQuery, setFilterOptionQuery] = useState("");
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (nameQuery.trim()) params.set("name", nameQuery.trim());
    return params.toString();
  }, [nameQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members${qs ? `?${qs}` : ""}`);
      const data = (await res.json()) as {
        items?: MemberItem[];
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "회원 목록을 불러오지 못했습니다.");
        return;
      }

      setItems(data.items ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  const getFilterRawValue = useCallback((item: MemberItem, key: ColumnFilterKey) => {
    switch (key) {
      case "role":
        return item.role;
      case "schoolName":
        return item.schoolName ?? "-";
      case "grade":
        return item.grade ?? "-";
      case "residenceCountry":
        return compactCountry(item.residenceCountry);
      default:
        return "-";
    }
  }, []);

  const getFilterOptions = useCallback(
    (key: ColumnFilterKey) => {
      const collator = new Intl.Collator("ko");
      return Array.from(new Set(items.map((item) => getFilterRawValue(item, key)))).sort((a, b) =>
        collator.compare(a, b)
      );
    },
    [getFilterRawValue, items]
  );

  const filteredItems = useMemo(() => {
    const list = items.filter((x) =>
      (Object.keys(columnFilters) as ColumnFilterKey[]).every((key) => {
        const selected = columnFilters[key];
        if (!selected.length) return true;
        return selected.includes(getFilterRawValue(x, key));
      })
    );

    const collator = new Intl.Collator("ko");
    return [...list].sort((a, b) => {
      const aValue =
        sortKey === "createdAt"
          ? new Date(a.createdAt).getTime()
          : sortKey === "residenceCountry"
            ? compactCountry(a.residenceCountry)
            : ((a[sortKey] ?? "") as string);
      const bValue =
        sortKey === "createdAt"
          ? new Date(b.createdAt).getTime()
          : sortKey === "residenceCountry"
            ? compactCountry(b.residenceCountry)
            : ((b[sortKey] ?? "") as string);

      const compared =
        typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : collator.compare(String(aValue), String(bValue));
      return sortDirection === "asc" ? compared : -compared;
    });
  }, [columnFilters, getFilterRawValue, items, sortDirection, sortKey]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!activeFilterKey) return;
      if (!filterMenuRef.current) return;
      if (filterMenuRef.current.contains(event.target as Node)) return;
      setActiveFilterKey(null);
    }
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [activeFilterKey]);

  function openFilterMenu(key: ColumnFilterKey) {
    if (activeFilterKey === key) {
      setActiveFilterKey(null);
      return;
    }
    setActiveFilterKey(key);
    setDraftFilterValues([...(columnFilters[key] ?? [])]);
    setFilterOptionQuery("");
  }

  function toggleDraftFilterValue(value: string) {
    setDraftFilterValues((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function applyColumnFilter() {
    if (!activeFilterKey) return;
    setColumnFilters((prev) => ({ ...prev, [activeFilterKey]: [...draftFilterValues] }));
    setActiveFilterKey(null);
  }

  function clearColumnFilter() {
    if (!activeFilterKey) return;
    setColumnFilters((prev) => ({ ...prev, [activeFilterKey]: [] }));
    setDraftFilterValues([]);
    setFilterOptionQuery("");
    setActiveFilterKey(null);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="text-slate-600">↕</span>;
    return <span className="text-sky-600">{sortDirection === "asc" ? "▲" : "▼"}</span>;
  }

  async function deleteMember(id: string) {
    setProcessingMemberId(id);
    setError(null);
    try {
      const ok = window.confirm("이 회원을 완전히 삭제하시겠습니까?\n계정과 관련 데이터가 영구 삭제되며 복구할 수 없습니다.");
      if (!ok) return;

      const res = await fetch(`/api/admin/members/${id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "MOVE_DELETED" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "회원 처리 중 오류가 발생했습니다.");
        return;
      }
      await load();
    } catch {
      setError("회원 처리 중 네트워크 오류가 발생했습니다.");
    } finally {
      setProcessingMemberId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)]">
      <section className="mx-auto max-w-6xl space-y-4 px-6 py-10">
        <h1 className="text-3xl font-bold text-slate-900">회원 관리</h1>
        <p className="text-sm text-slate-500">가입한 회원 목록을 확인하고 관리할 수 있는 화면입니다.</p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="이름(실명) 검색"
            className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-200 bg-[color:var(--surface)] px-3 text-sm"
          />
          <button onClick={() => void load()} className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800">새로고침</button>
          <button
            onClick={() => {
              setNameQuery("");
              setColumnFilters({ role: [], schoolName: [], grade: [], residenceCountry: [] });
              setDraftFilterValues([]);
              setFilterOptionQuery("");
              setActiveFilterKey(null);
              setSortKey("createdAt");
              setSortDirection("asc");
            }}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-800"
          >
            필터 초기화
          </button>
        </div>

        {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p> : null}

        <Card className="overflow-visible p-0">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">회원 데이터가 없습니다.</div>
          ) : (
            <div className="relative overflow-visible">
              <table className="w-full table-fixed border-collapse text-left text-sm text-slate-800">
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "23%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3">
                      <button onClick={() => toggleSort("realName")} className="inline-flex items-center gap-1 hover:text-slate-900">
                        이름 {sortIndicator("realName")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">
                      <button onClick={() => toggleSort("email")} className="inline-flex items-center gap-1 hover:text-slate-900">
                        이메일 {sortIndicator("email")}
                      </button>
                    </th>
                    {([
                      ["role", "권한"],
                      ["schoolName", "학교"],
                      ["grade", "졸업예정연도"],
                      ["residenceCountry", "국가"],
                    ] as Array<[ColumnFilterKey, string]>).map(([key, label]) => (
                      <th key={key} className={`relative whitespace-nowrap px-3 py-3 ${activeFilterKey === key ? "z-50" : ""}`}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => toggleSort(key)}
                            className="inline-flex items-center gap-1 hover:text-slate-900"
                          >
                            {label} {sortIndicator(key)}
                          </button>
                          <button
                            onClick={() => openFilterMenu(key)}
                            className={`rounded px-1 text-[11px] ${
                              columnFilters[key].length ? "bg-sky-500/20 text-sky-600" : "text-slate-500 hover:text-slate-900"
                            }`}
                            aria-label={`${label} 필터`}
                          >
                            ▼
                          </button>
                        </div>
                        {activeFilterKey === key ? (
                          <div
                            ref={filterMenuRef}
                            className="absolute right-0 top-full z-[120] mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-2xl"
                          >
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-600">
                              <span>{label} 필터</span>
                              <button
                                onClick={() => setDraftFilterValues(getFilterOptions(key))}
                                className="text-sky-600 hover:text-sky-700"
                              >
                                전체선택
                              </button>
                            </div>
                            <input
                              value={filterOptionQuery}
                              onChange={(e) => setFilterOptionQuery(e.target.value)}
                              placeholder="값 검색"
                              className="mb-2 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-500"
                            />
                            <div className="max-h-44 space-y-1 overflow-auto rounded border border-slate-200 p-1">
                              {getFilterOptions(key)
                                .filter((value) =>
                                  filterOptionQuery.trim()
                                    ? value.toLowerCase().includes(filterOptionQuery.trim().toLowerCase())
                                    : true
                                )
                                .map((value) => (
                                  <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-800 hover:bg-slate-100">
                                    <input
                                      type="checkbox"
                                      checked={draftFilterValues.includes(value)}
                                      onChange={() => toggleDraftFilterValue(value)}
                                    />
                                    <span className="truncate">{value}</span>
                                  </label>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-between gap-2">
                              <button
                                onClick={clearColumnFilter}
                                className="h-7 flex-1 rounded border border-slate-200 text-xs text-slate-800"
                              >
                                초기화
                              </button>
                              <button
                                onClick={applyColumnFilter}
                                className="h-7 flex-1 rounded bg-sky-600 text-xs font-medium text-white"
                              >
                                적용
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-3">
                      <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-slate-900">
                        가입일 {sortIndicator("createdAt")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((x) => (
                    <tr key={x.id} className="border-t border-slate-200/60 odd:bg-white/20 hover:bg-slate-100/40">
                      <td className="truncate whitespace-nowrap px-3 py-3 text-xs text-slate-600">{x.realName ?? "-"}</td>
                      <td className="truncate whitespace-nowrap px-4 py-3 font-medium text-slate-900">{x.email}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{ROLE_KO[x.role] ?? x.role}</td>
                      <td className="truncate whitespace-nowrap px-3 py-3 text-xs text-slate-600">{x.schoolName ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{x.grade ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{compactCountry(x.residenceCountry)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatKstDate(x.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => void deleteMember(x.id)}
                          disabled={processingMemberId === x.id}
                          className="whitespace-nowrap rounded-md bg-rose-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
