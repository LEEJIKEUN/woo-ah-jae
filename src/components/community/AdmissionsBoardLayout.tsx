"use client";

type Props = {
  sidebar: React.ReactNode;
  main: React.ReactNode;
};

export default function AdmissionsBoardLayout({ sidebar, main }: Props) {
  return (
    <div className="pageContainer mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 lg:px-8">
      <div
        className="twoCol grid items-start gap-6 max-md:grid-cols-1"
        style={{ gridTemplateColumns: "280px minmax(0, 1fr)" }}
      >
        <aside
          className="leftNav sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto max-md:static max-md:h-auto"
          style={{ width: 280, minWidth: 280, maxWidth: 280 }}
        >
          {sidebar}
        </aside>
        <main className="content min-w-0 w-full overflow-hidden">{main}</main>
      </div>
    </div>
  );
}
