type Props = {
  channels: string[];
  activeChannel: string;
  onChangeChannel: (channel: string) => void;
};

export default function SideChannelNav({ channels, activeChannel, onChangeChannel }: Props) {
  const allChannels = ["전체", ...channels];

  return (
    <>
      <div className="md:hidden">
        <label className="mb-2 block text-xs font-semibold text-slate-500">하위 채널</label>
        <select
          aria-label="모바일 하위 채널 선택"
          value={activeChannel}
          onChange={(e) => onChangeChannel(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {allChannels.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      </div>

      <aside className="hidden md:block">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-slate-500">하위 채널</p>
          <ul className="space-y-1">
            {allChannels.map((channel) => {
              const active = channel === activeChannel;
              return (
                <li key={channel}>
                  <button
                    type="button"
                    onClick={() => onChangeChannel(channel)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 ${
                      active
                        ? "bg-amber-50 font-bold text-amber-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-label={`${channel} 채널 보기`}
                  >
                    {channel}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </>
  );
}
