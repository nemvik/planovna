import { ReactNode } from 'react';

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AppShell({ eyebrow = 'Planovna', title, description, note, actions, children }: AppShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
      <header className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.35),_transparent_35%),linear-gradient(135deg,_rgba(248,250,252,1),_rgba(241,245,249,0.92))] px-6 py-8 lg:px-8 lg:py-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">{title}</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
          {note ? (
            <div className="mt-6 inline-flex max-w-3xl rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm backdrop-blur">
              {note}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mt-8 space-y-8">{children}</div>
    </main>
  );
}
