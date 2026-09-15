import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { gateStatus, lockSite } from "@/lib/gate.functions";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/materias-primas", label: "Matérias-primas" },
  { to: "/fornecedores", label: "Fornecedores" },
  { to: "/documentos", label: "Documentação" },
  { to: "/fabricas", label: "Fábricas" },
  { to: "/nova-analise", label: "Nova análise" },
];

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: gate } = useQuery({ queryKey: ["gate_status"], queryFn: () => gateStatus() });
  const user = gate?.user ?? null;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await lockSite();
    await navigate({ to: "/entrar", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-sm font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </span>
            Vigilância RASFF · BRC
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:font-semibold [&.active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <span className="ml-2 hidden text-right leading-tight sm:block">
                <span className="block text-xs font-semibold text-foreground">{user.name}</span>
                {user.role ? <span className="block text-[11px] text-muted-foreground">{user.role}</span> : null}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="ml-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
            {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
