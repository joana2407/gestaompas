import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { ESTADOS_MP_FABRICA, alergenioLabel } from "@/lib/domain";
import { gateStatus } from "@/lib/gate.functions";
import { catalogQuery } from "@/lib/queries";

export const Route = createFileRoute("/fabricas")({
  head: () => ({
    meta: [
      { title: "Fábricas e matérias-primas aprovadas | Gestão de MP" },
      {
        name: "description",
        content:
          "As três unidades fabris — fatiados, granel e sem glúten — com as matérias-primas ativas, em teste e alergénios bloqueados.",
      },
      { property: "og:title", content: "Fábricas e matérias-primas aprovadas" },
      { property: "og:description", content: "Matérias-primas por unidade fabril e restrições de alergénios." },
    ],
  }),
  beforeLoad: async () => {
    const { unlocked } = await gateStatus();
    if (!unlocked) throw redirect({ to: "/entrar" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: FactoriesPage,
});

function FactoriesPage() {
  const { data } = useSuspenseQuery(catalogQuery);

  return (
    <AppShell
      title="Fábricas"
      description="Matérias-primas aprovadas por unidade fabril e alergénios bloqueados em cada uma."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {data.factories.map((factory) => {
          const links = data.materialFactories.filter((mf) => mf.factory_id === factory.id);
          const byState = (state: string) => links.filter((l) => l.state === state);
          const blocked = factory.blocked_allergens ?? [];
          const conflicts = links.filter((link) => {
            if (link.state === "inativa") return false;
            const material = data.materials.find((m) => m.id === link.raw_material_id);
            if (!material) return false;
            const all = [...(material.allergens_formulation ?? []), ...(material.allergens_contamination ?? [])];
            return blocked.some((b) => all.includes(b));
          });

          return (
            <section key={factory.id} className="panel p-4">
              <h2 className="font-display text-base font-semibold">{factory.name}</h2>
              <p className="text-xs text-muted-foreground">{factory.code}</p>
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Alergénios bloqueados: </span>
                {blocked.length > 0 ? blocked.map(alergenioLabel).join(", ") : "nenhum"}
              </p>
              <dl className="mt-3 space-y-1 text-sm">
                {ESTADOS_MP_FABRICA.map((state) => (
                  <div key={state.id} className="flex justify-between">
                    <dt className="text-muted-foreground">{state.label}</dt>
                    <dd className="font-semibold">{byState(state.id).length}</dd>
                  </div>
                ))}
              </dl>
              {conflicts.length > 0 ? (
                <div className="mt-3 rounded-lg border border-high/30 bg-high-soft p-2 text-xs text-high">
                  {conflicts.length} matéria(s)-prima com alergénio bloqueado:
                  <ul className="mt-1 space-y-0.5">
                    {conflicts.slice(0, 5).map((link) => (
                      <li key={link.id}>
                        <Link
                          to="/materia-prima/$materialId"
                          params={{ materialId: link.raw_material_id }}
                          className="underline"
                        >
                          {data.materials.find((m) => m.id === link.raw_material_id)?.name ?? "MP"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
