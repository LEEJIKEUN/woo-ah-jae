"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminVerificationPanel from "@/components/admin-verification-panel";
import Card from "@/components/ui/Card";
import { formatKstDate } from "@/lib/date-format";

type MemberItem = {
  id: string;
  email: string;
  realName: string | null;
  role: "STUDENT" | "ADMIN";
  schoolName: string | null;
  grade: string | null;
  residenceCountry: string | null;
  verificationStatus: "NOT_SUBMITTED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED" | "UNKNOWN";
  planCode: string;
  entitlementStatus: "ACTIVE" | "EXPIRED" | "CANCELED" | "NONE";
  createdAt: string;
};

type SortKey =
  | "realName"
  | "email"
  | "role"
  | "schoolName"
  | "grade"
  | "residenceCountry"
  | "verificationStatus"
  | "planCode"
  | "entitlementStatus"
  | "createdAt";

type SortDirection = "asc" | "desc";
type ColumnFilterKey =
  | "role"
  | "schoolName"
  | "grade"
  | "residenceCountry"
  | "verificationStatus"
  | "planCode"
  | "entitlementStatus";

const verificationLabel: Record<MemberItem["verificationStatus"], string> = {
  NOT_SUBMITTED: "N/S",
  PENDING_REVIEW: "PEND",
  VERIFIED: "VER",
  REJECTED: "REJ",
  UNKNOWN: "UNK",
};

function compactCountry(value: string | null) {
  if (!value) return "-";
  const raw = value.trim();
  if (!raw) return "-";
  if (raw.length <= 3) return raw.toUpperCase();
  // Country name(Andorra 등)는 3글자 약어로 고정해 표 폭을 확보한다.
  return raw.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || raw.slice(0, 3).toUpperCase();
}

export default function AdminMembersPage() {
  const [items, setItems] = useState<MemberItem[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [source, setSource] = useState<"db" | "local" | "-">("-");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [columnFilters, setColumnFilters] = useState<Record<ColumnFilterKey, string[]>>({
    role: [],
    schoolName: [],
    grade: [],
    residenceCountry: [],
    verificationStatus: [],
    planCode: [],
    entitlementStatus: [],
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
        billingEnabled?: boolean;
        source?: "db" | "local";
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "회원 목록을 불러오지 못했습니다.");
        return;
      }

      setItems(data.items ?? []);
      setBillingEnabled(Boolean(data.billingEnabled));
      setSource(data.source ?? "-");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void load();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

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
      case "verificationStatus":
        return verificationLabel[item.verificationStatus];
      case "planCode":
        return item.planCode;
      case "entitlementStatus":
        return item.entitlementStatus;
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
        const current = getFilterRawValue(x, key);
        return selected.includes(current);
      })
    );

    const collator = new Intl.Collator("ko");
    return [...list].sort((a, b) => {
      const aValue =
        sortKey === "createdAt"
          ? new Date(a.createdAt).getTime()
          : sortKey === "residenceCountry"
            ? compactCountry(a.residenceCountry)
            : sortKey === "verificationStatus"
              ? verificationLabel[a.verificationStatus]
              : (a[sortKey] ?? "") as string;

      const bValue =
        sortKey === "createdAt"
          ? new Date(b.createdAt).getTime()
          : sortKey === "residenceCountry"
            ? compactCountry(b.residenceCountry)
            : sortKey === "verificationStatus"
              ? verificationLabel[b.verificationStatus]
              : (b[sortKey] ?? "") as string;

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
    setDraftFilterValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
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
    return <span className="text-sky-300">{sortDirection === "asc" ? "▲" : "▼"}</span>;
  }

  async function memberAction(id: string, action: "MOVE_DELETED" | "MOVE_ACHIEVED") {
    setProcessingMemberId(id);
    setError(null);
    try {
      const ok = window.confirm(
        action === "MOVE_DELETED"
          ? "정말 Delete 처리하시겠습니까? (복구는 관리자 복구 기능에서 가능합니다)"
          : "이 회원을 Achieve 상태로 이동하시겠습니까?"
      );
      if (!ok) return;

      const res = await fetch(`/api/admin/members/${id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
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
        <h1 className="text-3xl font-bold text-slate-100">회원 관리 (구독관리)</h1>
        <p className="text-sm text-slate-400">구독/인증 상태를 실시간에 가깝게 관리할 수 있도록 구성된 관리자 화면입니다.</p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="이름(실명) 검색"
            className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-600 bg-[color:var(--surface)] px-3 text-sm"
          />
          <button onClick={() => void load()} className="h-9 rounded-md border border-slate-500 px-3 text-sm text-slate-200">새로고침</button>
          <button onClick={() => setAutoRefresh((v) => !v)} className="h-9 rounded-md border border-slate-500 px-3 text-sm text-slate-200">자동갱신: {autoRefresh ? "ON" : "OFF"}</button>
          <button
            onClick={() => {
              setNameQuery("");
              setColumnFilters({
                role: [],
                schoolName: [],
                grade: [],
                residenceCountry: [],
                verificationStatus: [],
                planCode: [],
                entitlementStatus: [],
              });
              setDraftFilterValues([]);
              setFilterOptionQuery("");
              setActiveFilterKey(null);
              setSortKey("createdAt");
              setSortDirection("asc");
            }}
            className="h-9 rounded-md border border-slate-500 px-3 text-sm text-slate-200"
          >
            필터 초기화
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-300">
            현재 정렬: {sortKey} ({sortDirection === "asc" ? "오름차순" : "내림차순"})
          </div>
        </div>

        <p className="text-xs text-slate-400">데이터 소스: {source} · billingEnabled: {String(billingEnabled)}</p>

        {loading ? <p className="text-sm text-slate-400">불러오는 중...</p> : null}
        {error ? <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}

        <Card className="overflow-visible p-0">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">회원 데이터가 없습니다.</div>
          ) : (
            <div className="relative overflow-x-auto overflow-y-visible">
              <table className="min-w-[1320px] table-fixed border-collapse text-left text-sm text-slate-200">
                <colgroup>
                  <col className="w-[52px]" />
                  <col className="w-[140px]" />
                  <col className="w-[370px]" />
                  <col className="w-[110px]" />
                  <col className="w-[210px]" />
                  <col className="w-[78px]" />
                  <col className="w-[78px]" />
                  <col className="w-[86px]" />
                  <col className="w-[86px]" />
                  <col className="w-[86px]" />
                  <col className="w-[118px]" />
                  <col className="w-[98px]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3">순</th>
                    <th className="whitespace-nowrap px-3 py-3">
                      <button onClick={() => toggleSort("realName")} className="inline-flex items-center gap-1 hover:text-white">
                        이름 {sortIndicator("realName")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">
                      <button onClick={() => toggleSort("email")} className="inline-flex items-center gap-1 hover:text-white">
                        이메일 {sortIndicator("email")}
                      </button>
                    </th>
                    {([
                      ["role", "권한"],
                      ["schoolName", "학교"],
                      ["grade", "학년"],
                      ["residenceCountry", "국가"],
                      ["verificationStatus", "인증"],
                      ["planCode", "플랜"],
                      ["entitlementStatus", "구독"],
                    ] as Array<[ColumnFilterKey, string]>).map(([key, label]) => (
                      <th key={key} className={`relative whitespace-nowrap px-3 py-3 ${activeFilterKey === key ? "z-50" : ""}`}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => toggleSort(key)}
                            className="inline-flex items-center gap-1 hover:text-white"
                          >
                            {label} {sortIndicator(key)}
                          </button>
                          <button
                            onClick={() => openFilterMenu(key)}
                            className={`rounded px-1 text-[11px] ${
                              columnFilters[key].length ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:text-white"
                            }`}
                            aria-label={`${label} 필터`}
                          >
                            ▼
                          </button>
                        </div>
                        {activeFilterKey === key ? (
                          <div
                            ref={filterMenuRef}
                            className="absolute right-0 top-full z-[120] mt-1 w-56 rounded-md border border-slate-600 bg-slate-900 p-2 shadow-2xl"
                          >
                            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                              <span>{label} 필터</span>
                              <button
                                onClick={() => setDraftFilterValues(getFilterOptions(key))}
                                className="text-sky-300 hover:text-sky-200"
                              >
                                전체선택
                              </button>
                            </div>
                            <input
                              value={filterOptionQuery}
                              onChange={(e) => setFilterOptionQuery(e.target.value)}
                              placeholder="값 검색"
                              className="mb-2 h-8 w-full rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 placeholder:text-slate-500"
                            />
                            <div className="max-h-44 space-y-1 overflow-auto rounded border border-slate-700 p-1">
                              {getFilterOptions(key)
                                .filter((value) =>
                                  filterOptionQuery.trim()
                                    ? value.toLowerCase().includes(filterOptionQuery.trim().toLowerCase())
                                    : true
                                )
                                .map((value) => (
                                <label key={value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-200 hover:bg-slate-800">
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
                                className="h-7 flex-1 rounded border border-slate-600 text-xs text-slate-200"
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
                      <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-white">
                        가입일 {sortIndicator("createdAt")}
                      </button>
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((x, idx) => (
                    <tr key={x.id} className="border-t border-slate-700/60 odd:bg-slate-900/20 hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400">{idx + 1}</td>
                      <td className="truncate whitespace-nowrap px-3 py-3 text-xs text-slate-300">{x.realName ?? "-"}</td>
                      <td className="truncate whitespace-nowrap px-4 py-3 font-medium text-slate-100">{x.email}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{x.role}</td>
                      <td className="truncate whitespace-nowrap px-3 py-3 text-xs text-slate-300">{x.schoolName ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{x.grade ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{compactCountry(x.residenceCountry)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{verificationLabel[x.verificationStatus]}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{x.planCode}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{x.entitlementStatus}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400">{formatKstDate(x.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => void memberAction(x.id, "MOVE_DELETED")}
                            disabled={processingMemberId === x.id}
                            className="whitespace-nowrap rounded-md bg-rose-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => void memberAction(x.id, "MOVE_ACHIEVED")}
                            disabled={processingMemberId === x.id}
                            className="whitespace-nowrap rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-40"
                          >
                            Achieve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <AdminVerificationPanel />
      </section>
    </main>
  );
}
