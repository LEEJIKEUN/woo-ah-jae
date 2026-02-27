"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { formatKstDateTime } from "@/lib/date-format";

type Message = {
  id: string;
  projectId: string;
  content: string;
  type: "TEXT" | "FILE";
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    school: string;
    grade: string;
  };
};

type Schedule = {
  id: string;
  title: string;
  note?: string | null;
  date: string;
  done: boolean;
  createdAt: string;
  creator: {
    id: string;
    name: string;
  };
};

type Props = {
  projectId: string;
  canManage: boolean;
  projectTitle: string;
  summary: string;
  config: {
    googleDriveUrl: string | null;
    googleSheetUrl: string | null;
    googleDocsUrl: string | null;
    zoomMeetingUrl: string | null;
    projectOverview: string | null;
    pinnedNotice: string | null;
  };
  initialMessages: Message[];
  initialSchedules: Schedule[];
};

const CALENDAR_CELL_HEIGHT = 96;

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDayKey(dateLike: string | Date) {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMondayStartIndex(date: Date) {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function dayKeyToDate(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function ExternalLinkButton({ label, href }: { label: string; href: string | null }) {
  if (!href) {
    return <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-500">{label}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-slate-600 px-2 py-1 text-slate-200 hover:border-slate-400"
    >
      {label}
    </a>
  );
}

export default function WorkspaceHomeClient(props: Props) {
  const now = useMemo(() => new Date(), []);
  const [messages, setMessages] = useState<Message[]>(props.initialMessages);
  const [schedules, setSchedules] = useState<Schedule[]>(props.initialSchedules);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [input, setInput] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [overview, setOverview] = useState(props.config.projectOverview ?? "");
  const [sending, setSending] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [overviewSaving, setOverviewSaving] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const monthStartWeekday = useMemo(
    () => getMondayStartIndex(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)),
    [currentMonth]
  );
  const daysInMonth = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate(),
    [currentMonth]
  );

  const selectedDayKey = toDayKey(selectedDate);

  const selectedDateSchedules = useMemo(
    () => schedules.filter((item) => toDayKey(item.date) === selectedDayKey),
    [schedules, selectedDayKey]
  );

  useEffect(() => {
    void fetch("/api/socket");
    const socket = io({ path: "/api/socketio" });
    socketRef.current = socket;
    socket.emit("workspace:join", props.projectId);

    socket.on("workspace:new-message", (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((x) => x.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("workspace:schedule-updated", (nextSchedules: Schedule[]) => {
      setSchedules(nextSchedules);
    });

    socket.on("workspace:overview-updated", (nextOverview: string) => {
      setOverview(nextOverview ?? "");
    });

    return () => {
      socket.emit("workspace:leave", props.projectId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [props.projectId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const selectedMonthKey = formatMonthKey(currentMonth);
    if (formatMonthKey(selectedDate) !== selectedMonthKey) {
      setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    }
  }, [currentMonth, selectedDate]);

  useEffect(() => {
    void refreshSchedulesByMonth(currentMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  async function saveOverview() {
    setOverviewSaving(true);
    try {
      const res = await fetch(`/api/workspace/${props.projectId}/overview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectOverview: overview.trim() || null }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "프로젝트 개요 저장 실패");
      socketRef.current?.emit("workspace:overview-updated", {
        projectId: props.projectId,
        overview: overview.trim(),
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "프로젝트 개요 저장 실패");
    } finally {
      setOverviewSaving(false);
    }
  }

  async function sendMessage(payload: { content: string; type?: "TEXT" | "FILE"; fileUrl?: string; fileName?: string }) {
    setSending(true);
    try {
      const res = await fetch(`/api/workspace/${props.projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; item?: Message };
      if (!res.ok || !json.item) throw new Error(json.error ?? "메시지 전송 실패");

      setMessages((prev) => {
        if (prev.some((x) => x.id === json.item!.id)) return prev;
        return [...prev, json.item!];
      });
      socketRef.current?.emit("workspace:new-message", { projectId: props.projectId, message: json.item });
      setInput("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "메시지 전송 실패");
    } finally {
      setSending(false);
    }
  }

  async function onFileSelected(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(`/api/workspace/${props.projectId}/upload`, {
      method: "POST",
      body: formData,
    });
    const uploadJson = (await uploadRes.json()) as {
      error?: string;
      fileUrl?: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
    };
    if (!uploadRes.ok || !uploadJson.fileUrl || !uploadJson.fileName || !uploadJson.mimeType || !uploadJson.size) {
      throw new Error(uploadJson.error ?? "업로드 실패");
    }

    await fetch(`/api/workspace/${props.projectId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: uploadJson.fileUrl,
        fileName: uploadJson.fileName,
        mimeType: uploadJson.mimeType,
        size: uploadJson.size,
      }),
    });

    await sendMessage({
      content: `${uploadJson.fileName} 파일을 공유했습니다.`,
      type: "FILE",
      fileUrl: uploadJson.fileUrl,
      fileName: uploadJson.fileName,
    });
  }

  async function refreshSchedulesByMonth(month: Date) {
    const monthKey = formatMonthKey(month);
    const res = await fetch(`/api/workspace/${props.projectId}/schedules?month=${monthKey}`);
    const json = (await res.json()) as { items?: Schedule[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? "일정 조회 실패");
    const next = json.items ?? [];
    setSchedules(next);
    return next;
  }

  async function refreshSchedulesAndBroadcast(month: Date) {
    const next = await refreshSchedulesByMonth(month);
    socketRef.current?.emit("workspace:schedule-updated", { projectId: props.projectId, schedules: next });
  }

  async function addSchedule() {
    if (!scheduleTitle.trim()) return;
    setScheduleLoading(true);
    try {
      const picked = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9, 0, 0, 0);
      const res = await fetch(`/api/workspace/${props.projectId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scheduleTitle.trim(),
          note: scheduleNote.trim() || null,
          date: picked.toISOString(),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "일정 추가 실패");

      setScheduleTitle("");
      setScheduleNote("");
      await refreshSchedulesAndBroadcast(currentMonth);
    } catch (error) {
      alert(error instanceof Error ? error.message : "일정 추가 실패");
    } finally {
      setScheduleLoading(false);
    }
  }

  async function toggleSchedule(scheduleId: string, done: boolean) {
    setScheduleLoading(true);
    try {
      const res = await fetch(`/api/workspace/${props.projectId}/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "일정 변경 실패");
      await refreshSchedulesAndBroadcast(currentMonth);
    } catch (error) {
      alert(error instanceof Error ? error.message : "일정 변경 실패");
    } finally {
      setScheduleLoading(false);
    }
  }

  async function removeSchedule(scheduleId: string) {
    setScheduleLoading(true);
    try {
      const res = await fetch(`/api/workspace/${props.projectId}/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "일정 삭제 실패");
      await refreshSchedulesAndBroadcast(currentMonth);
    } catch (error) {
      alert(error instanceof Error ? error.message : "일정 삭제 실패");
    } finally {
      setScheduleLoading(false);
    }
  }

  const dayCells = useMemo(() => {
    const cells: Array<{ day: number; key: string; inCurrentMonth: boolean }> = [];
    const prevMonthLastDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();

    for (let i = monthStartWeekday - 1; i >= 0; i -= 1) {
      const day = prevMonthLastDate - i;
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, day);
      cells.push({ day, key: toDayKey(d), inCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      cells.push({ day, key: toDayKey(d), inCurrentMonth: true });
    }

    let nextDay = 1;
    while (cells.length < 42) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, nextDay);
      cells.push({ day: nextDay, key: toDayKey(d), inCurrentMonth: false });
      nextDay += 1;
    }

    return cells;
  }, [currentMonth, daysInMonth, monthStartWeekday]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
        <h1 className="text-2xl font-bold text-slate-100">{props.projectTitle}</h1>
        <p className="mt-1 text-sm text-slate-300">{props.summary}</p>
        {props.config.pinnedNotice ? (
          <p className="mt-3 rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            📌 공지: {props.config.pinnedNotice}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Link href={`/workspace/${props.projectId}/files`} className="rounded-md border border-slate-600 px-2 py-1 text-slate-200 hover:border-slate-400">자료실</Link>
          {props.canManage ? <Link href={`/workspace/${props.projectId}/settings`} className="rounded-md border border-slate-600 px-2 py-1 text-slate-200 hover:border-slate-400">워크스페이스 설정</Link> : null}
          <ExternalLinkButton label="Google Drive" href={props.config.googleDriveUrl} />
          <ExternalLinkButton label="Google Sheet" href={props.config.googleSheetUrl} />
          <ExternalLinkButton label="Google Docs" href={props.config.googleDocsUrl} />
          <ExternalLinkButton label="Zoom Meeting" href={props.config.zoomMeetingUrl} />
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-100">일정 관리</h2>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <button type="button" onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))} className="rounded-md border border-slate-600 px-2 py-1 hover:border-slate-400">이전 달</button>
            <span className="min-w-[150px] text-center text-sm font-semibold tracking-[0.1em] text-slate-100">{currentMonth.getFullYear()} {currentMonth.toLocaleString("en-US", { month: "short" }).toUpperCase()}</span>
            <button type="button" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))} className="rounded-md border border-slate-600 px-2 py-1 hover:border-slate-400">다음 달</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-700/80">
          <div className="grid bg-slate-900 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-200" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((label, index) => (
              <div key={label} className={`py-2 ${index === 6 ? "" : "border-r border-slate-700/80"}`}>{label}</div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: `repeat(6, ${CALENDAR_CELL_HEIGHT}px)` }}>
            {dayCells.map((cell, index) => {
              const selected = cell.key === selectedDayKey;
              const cellDate = dayKeyToDate(cell.key);
              const events = schedules.filter((item) => toDayKey(item.date) === cell.key);
              const isLastCol = index % 7 === 6;

              return (
                <button
                  key={`${cell.key}-${index}`}
                  type="button"
                  onClick={() => setSelectedDate(cellDate)}
                  className={`grid h-full min-h-0 w-full grid-rows-[auto_1fr] overflow-hidden border-t border-slate-800/80 p-1.5 text-left transition hover:bg-slate-900/40 ${isLastCol ? "" : "border-r border-slate-800/80"} ${selected ? "bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/60" : "bg-slate-950/30"}`}
                >
                  <div className={`text-xs font-semibold ${cell.inCurrentMonth ? "text-slate-100" : "text-slate-500"}`}>{cell.day}</div>
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {events.slice(0, 2).map((event) => (
                      <div key={event.id} className={`truncate whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] ${event.done ? "bg-slate-700/70 text-slate-300 line-through" : "bg-rose-300/20 text-rose-100"}`}>
                        {event.title}
                      </div>
                    ))}
                    {events.length > 2 ? <div className="text-[10px] text-slate-400">+{events.length - 2}개</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-slate-700/80 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold text-slate-300">{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정</p>
          <div className="mt-2 space-y-2">
            <div className="space-y-1.5">
              {selectedDateSchedules.length === 0 ? (
                <p className="text-xs text-slate-500">선택한 날짜에 등록된 일정이 없습니다.</p>
              ) : (
                selectedDateSchedules.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-800/80 bg-slate-900/40 px-2 py-2">
                    <label className="flex min-w-0 items-start gap-2 text-xs text-slate-200">
                      <input type="checkbox" checked={item.done} onChange={(e) => void toggleSchedule(item.id, e.target.checked)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className={item.done ? "line-through text-slate-500" : "text-slate-100"}>{item.title}</span>
                        {item.note ? <span className="mt-0.5 block text-[11px] text-slate-400">{item.note}</span> : null}
                      </span>
                    </label>
                    <button type="button" onClick={() => void removeSchedule(item.id)} className="text-[11px] text-rose-300 hover:text-rose-200">삭제</button>
                  </div>
                ))
              )}
            </div>

            <input value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} className="h-8 w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-2 text-xs text-slate-100" placeholder="일정 또는 To-do 제목" />
            <input value={scheduleNote} onChange={(e) => setScheduleNote(e.target.value)} className="h-8 w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-2 text-xs text-slate-100" placeholder="메모(선택)" />
            <button type="button" disabled={scheduleLoading || !scheduleTitle.trim()} onClick={addSchedule} className="w-full rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-50">일정 추가</button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">프로젝트 개요</h2>
            <button type="button" onClick={() => void saveOverview()} disabled={overviewSaving} className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-50">
              {overviewSaving ? "저장 중..." : "저장"}
            </button>
          </div>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={18}
            className="w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
            placeholder="팀원 모두가 함께 작성하는 프로젝트 개요 공간입니다. 목표, 역할 분담, 일정, 진행 현황 등을 기록하세요."
          />
          <p className="text-xs text-slate-500">저장하면 같은 팀원의 화면에도 반영됩니다.</p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-700/70 bg-[color:var(--surface)] p-4">
          <h2 className="text-lg font-semibold text-slate-100">실시간 채팅</h2>

          <div ref={listRef} className="h-[420px] overflow-y-auto rounded-md border border-slate-700/80 bg-slate-950/40 p-3">
            <div className="space-y-3">
              {messages.map((message) => (
                <article key={message.id} className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-300">{message.user.school} · {message.user.grade} · {message.user.name}</p>
                    <p className="text-[11px] text-slate-500">{formatKstDateTime(message.createdAt)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{message.content}</p>
                  {message.type === "FILE" && message.fileUrl ? (
                    <a href={message.fileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-cyan-300 hover:text-cyan-200">첨부파일 열기: {message.fileName ?? "파일"}</a>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-600/80 bg-[color:var(--surface)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400"
              placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!input.trim() || sending) return;
                  await sendMessage({ content: input.trim() });
                }
              }}
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-slate-500/80 px-3 py-2 text-xs text-slate-200 hover:border-slate-300">
                파일 첨부
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await onFileSelected(file);
                    } catch (error) {
                      alert(error instanceof Error ? error.message : "파일 전송 실패");
                    } finally {
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <button type="button" disabled={sending || !input.trim()} onClick={() => sendMessage({ content: input.trim() })} className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50">
                전송
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
