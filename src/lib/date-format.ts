function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toSgtParts(value: string | number | Date) {
  const base = new Date(value);
  // Store dates in UTC and render in Singapore time (SGT, UTC+8).
  const sgt = new Date(base.getTime() + 8 * 60 * 60 * 1000);

  return {
    year: sgt.getUTCFullYear(),
    month: sgt.getUTCMonth() + 1,
    day: sgt.getUTCDate(),
    hour: sgt.getUTCHours(),
    minute: sgt.getUTCMinutes(),
    second: sgt.getUTCSeconds(),
  };
}

export function formatKstDate(value: string | number | Date) {
  const p = toSgtParts(value);
  return `${p.year}.${pad2(p.month)}.${pad2(p.day)}`;
}

export function formatKstDateTime(value: string | number | Date) {
  const p = toSgtParts(value);
  return `${p.year}.${pad2(p.month)}.${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}
