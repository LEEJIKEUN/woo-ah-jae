"use client";

type Props = {
  channels: string[];
  activeChannel: string;
  onChangeChannel: (channel: string) => void;
};

export default function SubChannelTextNav({ channels, activeChannel, onChangeChannel }: Props) {
  const allChannels = ["전체", ...channels];

  return (
    <nav aria-label="하위 채널" className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex items-center gap-2 text-sm">
        {allChannels.map((channel, index) => (
          <span key={channel} className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeChannel(channel)}
              className={`transition ${
                channel === activeChannel
                  ? "font-semibold text-slate-100"
                  : "font-normal text-slate-400 hover:text-slate-200"
              }`}
            >
              {channel}
            </button>
            {index < allChannels.length - 1 ? <span className="text-slate-600">|</span> : null}
          </span>
        ))}
      </div>
    </nav>
  );
}
