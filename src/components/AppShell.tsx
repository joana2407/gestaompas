import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Factory, FileText, Home, LogOut, Menu, Package, Settings, ShieldCheck, Upload, Users, X, Radar } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { gateStatus, lockSite } from "@/lib/gate.functions";

const NAV = [
  { to: "/", label: "Dashboard", group: "principal", icon: Home },
  { to: "/fabricas", label: "Fábricas", group: "principal", icon: Factory },
  { to: "/materias-primas", label: "Matérias-primas", group: "gestao", icon: Package },
  { to: "/fornecedores", label: "Fornecedores", group: "gestao", icon: Users },
  { to: "/nova-analise", label: "Nova análise", group: "documentos", icon: Upload },
  { to: "/vigilancia", label: "Vigilância RASFF", group: "documentos", icon: Radar },
  { to: "/documentos", label: "Documentação", group: "documentos", icon: FileText },
  { to: "/conformidade", label: "Conformidade", group: "documentos", icon: ShieldCheck },
  { to: "/configuracao", label: "Utilizadores", group: "config", icon: Settings },
] as const;

const GROUPS = [
  { id: "principal", label: "Principal" },
  { id: "gestao", label: "Gestão" },
  { id: "documentos", label: "Documentos" },
  { id: "config", label: "Configuração" },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: gate } = useQuery({ queryKey: ["gate_status"], queryFn: () => gateStatus() });
  const user = gate?.user ?? null;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await lockSite();
    await navigate({ to: "/entrar", replace: true });
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-5 py-5">
        <Link to="/" className="flex min-w-0 items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="truncate text-sm font-bold tracking-normal">Gestão Matérias Primas A&amp;S</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
        {GROUPS.filter((g) => g.id !== "config" || user?.permissions?.includes("gerir_utilizadores")).map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {NAV.filter((item) => item.group === group.id && (item.to !== "/configuracao" || user?.permissions?.includes("gerir_utilizadores"))).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === "/" }}
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-primary [&.active]:font-medium [&.active]:text-primary-foreground"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    <ChevronRight className="ml-auto hidden size-3 shrink-0 opacity-70 group-[.active]:block" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60 px-3 py-4">
        {user ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{user.name}</span>
              {user.role ? <span className="block truncate text-[10px] text-muted-foreground">{user.role}</span> : null}
            </span>
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => void signOut()} title="Terminar sessão">
              <LogOut className="size-3.5" />
              <span className="sr-only">Terminar sessão</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/60 bg-card shadow-sm lg:flex">
        <SidebarContent />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-foreground/35" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-lg">
            <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 z-10 size-8" onClick={() => setSidebarOpen(false)}>
              <X className="size-4" />
              <span className="sr-only">Fechar menu</span>
            </Button>
            <SidebarContent />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 bg-card px-3 shadow-xs sm:gap-4 sm:px-6">
          <Button type="button" variant="ghost" size="icon" className="size-8 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-4" />
            <span className="sr-only">Abrir menu</span>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
            {description ? <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => void signOut()}>
              <LogOut className="size-3.5" /> Trocar utilizador
            </Button>
            {actions}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 pb-24 sm:p-6 lg:pb-6">{children}</div>
        </main>

        <nav className="shrink-0 border-t border-border/70 bg-card/95 px-2 pt-2 pb-2 backdrop-blur lg:hidden" aria-label="Navegação rápida">
          <div className="grid grid-cols-4 gap-1">
            {NAV.filter((item) => ["/", "/materias-primas", "/fornecedores"].includes(item.to)).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/" }} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-medium text-muted-foreground [&.active]:bg-primary/10 [&.active]:text-primary">
                  <Icon className="size-4" />
                  <span className="max-w-full truncate">{item.to === "/materias-primas" ? "MP" : item.label}</span>
                </Link>
              );
            })}
            <Button type="button" variant="ghost" className="min-h-12 flex-col gap-0.5 px-1 text-[10px] font-medium text-muted-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="size-4" /><span>Menu</span>
            </Button>
          </div>
        </nav>
      </div>
    </div>
  );
}
