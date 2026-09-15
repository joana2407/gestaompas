import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { gateStatus } from "@/lib/gate.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, CalendarRange } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractTextFromFile, readSpreadsheetRows } from "@/lib/file-text";
import { groupRowsByWeek, looksStructured, type WeekBucket } from "@/lib/rasff-table";
import { materialsQuery } from "@/lib/queries";
import { runRasffAnalysis } from "@/lib/rasff.functions";


export const Route = createFileRoute("/nova-analise")({
  head: () => ({
    meta: [
      { title: "Nova análise semanal RASFF | Vigilância RASFF" },
      {
        name: "description",
        content:
          "Carregue a listagem semanal de alertas RASFF em PDF, Excel ou CSV e obtenha a avaliação de risco das matérias-primas.",
      },
      { property: "og:title", content: "Nova análise semanal RASFF" },
      { property: "og:description", content: "Upload dos alertas da semana e classificação automática de risco por MP." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(materialsQuery),
  component: NewAnalysis,
});

function isoWeekLabel(date = new Date()) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `Semana ${String(week).padStart(2, "0")}/${target.getUTCFullYear()}`;
}

function NewAnalysis() {
  const { data: materials } = useSuspenseQuery(materialsQuery);
  const analyse = useServerFn(runRasffAnalysis);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [weekLabel, setWeekLabel] = useState(isoWeekLabel());
  const [weekStart, setWeekStart] = useState("");
  const [filename, setFilename] = useState("");
  const [text, setText] = useState("");
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleFile(file: File) {
    setReading(true);
    setWeeks([]);
    setSelected(new Set());
    try {
      const name = file.name.toLowerCase();
      if (/\.(xlsx|xls|xlsm|csv)$/.test(name)) {
        const rows = await readSpreadsheetRows(file);
        if (looksStructured(rows)) {
          const buckets = groupRowsByWeek(rows);
          if (buckets.length > 0) {
            setWeeks(buckets);
            setSelected(new Set(buckets.map((b) => b.key)));
            setText("");
            setFilename(file.name);
            toast.success(`${rows.length} alertas lidos em ${buckets.length} semanas.`);
            return;
          }
        }
      }
      const extracted = await extractTextFromFile(file);
      if (extracted.trim().length < 20) {
        throw new Error("Não foi possível ler texto deste ficheiro. Se for um PDF digitalizado, cole o texto abaixo.");
      }
      setText(extracted);
      setFilename(file.name);
      toast.success(`Alertas lidos de ${file.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ler o ficheiro.");
    } finally {
      setReading(false);
    }
  }

  async function handleRun() {
    if (materials.length === 0) {
      toast.error("Importe primeiro o inventário de matérias-primas.");
      return;
    }
    setRunning(true);
    try {
      if (weeks.length > 0) {
        const chosen = weeks.filter((w) => selected.has(w.key));
        if (chosen.length === 0) {
          toast.error("Selecione pelo menos uma semana.");
          return;
        }
        let done = 0;
        let atRisk = 0;
        let lastId: string | null = null;
        for (const week of chosen) {
          setProgress(`${week.label} (${done + 1}/${chosen.length})`);
          try {
            const result = await analyse({
              data: {
                weekLabel: week.label,
                weekStart: week.weekStart,
                filename: filename || null,
                alerts: week.alerts,
              },
            });
            atRisk += result.atRisk;
            lastId = result.analysisId;
          } catch (error) {
            toast.error(`${week.label}: ${error instanceof Error ? error.message : "falhou"}`);
          }
          done += 1;
        }
        await queryClient.invalidateQueries();
        toast.success(`${done} semanas analisadas · ${atRisk} classificações de MP em risco.`);
        if (chosen.length === 1 && lastId) {
          void navigate({ to: "/analise/$analysisId", params: { analysisId: lastId } });
        } else {
          void navigate({ to: "/" });
        }
        return;
      }

      const result = await analyse({
        data: { weekLabel, weekStart: weekStart || null, filename: filename || null, text },
      });
      await queryClient.invalidateQueries();
      toast.success(`${result.alerts} alertas analisados · ${result.atRisk} MP em risco.`);
      void navigate({ to: "/analise/$analysisId", params: { analysisId: result.analysisId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A análise falhou.");
    } finally {
      setRunning(false);
      setProgress("");
    }
  }

  function toggleWeek(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }


  return (
    <AppShell
      title="Nova análise semanal"
      description="Carregue a listagem de alertas RASFF da semana. A análise cruza cada alerta com as MP, ingredientes componentes e origens do inventário."
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">1. Identificação da semana</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="week">Semana</Label>
              <Input id="week" value={weekLabel} onChange={(event) => setWeekLabel(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="start">Início da semana</Label>
              <Input id="start" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
            </div>
          </div>

          <h2 className="mt-7 text-base font-semibold">2. Listagem de alertas</h2>
          <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center transition-colors hover:border-primary/50">
            {reading ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <FileUp className="size-6 text-primary" />
            )}
            <span className="text-sm font-medium">Carregar ficheiro RASFF (PDF, Excel ou CSV)</span>
            <span className="text-xs text-muted-foreground">
              {filename ? `Ficheiro atual: ${filename}` : "Também pode colar o texto dos alertas em baixo"}
            </span>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,.txt"
              className="hidden"
              disabled={reading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleFile(file);
              }}
            />
          </label>

          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Texto dos alertas RASFF da semana…"
            className="mt-3 min-h-40 font-mono text-xs"
          />

          <Button className="mt-4 w-full" disabled={running || reading || text.trim().length < 20} onClick={handleRun}>
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {running ? "A analisar alertas e MP…" : "Analisar e gerar relatório"}
          </Button>
        </section>

        <aside className="panel h-fit p-5 text-sm">
          <h2 className="text-base font-semibold">Como é avaliado o risco</h2>
          <ul className="mt-3 space-y-3 text-muted-foreground">
            <li>
              <strong className="text-high">Risco alto</strong> — a MP ou um ingrediente componente é o produto do
              alerta, ou vem da mesma origem/fabricante.
            </li>
            <li>
              <strong className="text-medium-foreground">Risco médio</strong> — a origem coincide e o tipo de produto é
              similar, mas a confirmação é incerta.
            </li>
            <li>
              <strong className="text-low">Risco baixo</strong> — a origem coincide mas o produto ou fabricante é
              claramente diferente.
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Inventário atual: {materials.length} matérias-primas (
            {materials.filter((m) => m.kind === "composta").length} compostas). O relatório fica sempre disponível para
            revisão manual antes de ser fechado.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
