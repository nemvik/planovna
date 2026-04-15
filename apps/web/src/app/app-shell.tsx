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
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-sky-700">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">{description}</p>
            {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </header>

      <div className="mt-6 space-y-6">{children}</div>
    </main>
  );
}
