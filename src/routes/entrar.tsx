import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockSite } from "@/lib/gate.functions";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Acesso da equipa | Gestão Matérias Primas A&S" },
      {
        name: "description",
        content: "Acesso reservado à equipa de qualidade para gestão de matérias-primas, fornecedores e documentação.",
      },
      { property: "og:title", content: "Acesso da equipa — Gestão Matérias Primas A&S" },
      { property: "og:description", content: "Área reservada à equipa de qualidade. Acesso protegido por PIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Unlock,
});

function Unlock() {
  const unlock = useServerFn(unlockSite);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const { ok } = await unlock({ data: { pin } });
      if (!ok) {
        setError(true);
        return;
      }
      queryClient.clear();
      await navigate({ to: "/", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="card-elegant w-full max-w-sm p-7">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold">Gestão Matérias Primas A&amp;S</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Área reservada à equipa de qualidade. Introduza o seu PIN pessoal.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pin">PIN pessoal</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-high">PIN incorreto. Tente novamente.</p> : null}
          <Button type="submit" disabled={busy || pin.length === 0}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
