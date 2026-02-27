"use client";

import { useMemo, useState } from "react";

type Props = {
  channels: string[];
  activeChannel: string;
  onChangeChannel: (channel: string) => void;
};

function IconGlyph({ label }: { label: string }) {
  const glyph = useMemo(() => label.replace(/\s+/g, "").charAt(0), [label]);

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[11px] font-semibold text-slate-200">
      {glyph}
    </span>
  );
}

export default function ChannelIconBar({ channels, activeChannel, onChangeChannel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const allChannels = ["전체", ...channels];

  return (
    <section
      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">하위 채널</p>
        <p className="text-xs text-slate-500">hover 시 펼쳐집니다</p>
      </div>

      <div
        className={`flex gap-2 transition-all ${
          expanded
            ? "max-h-44 flex-wrap overflow-y-auto"
            : "max-h-10 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }`}
      >
        {allChannels.map((channel) => {
          const active = channel === activeChannel;

          return (
            <button
              key={channel}
              type="button"
              onClick={() => onChangeChannel(channel)}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                active
                  ? "border-slate-100 bg-slate-100/10 text-slate-100"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-slate-100"
              }`}
            >
              <IconGlyph label={channel} />
              <span>{channel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
