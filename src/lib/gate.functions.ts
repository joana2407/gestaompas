import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ pin: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { gateSession, pinMatches, teamMembers } = await import("./gate.server");

    const member = teamMembers().find((m) => pinMatches(data.pin, m.pin));
    if (member) {
      const session = await gateSession();
      await session.update({ unlocked: true, name: member.name, role: member.role });
      return { ok: true as const, name: member.name };
    }

    // Shared fallback PIN, kept for the team while personal PINs roll out.
    const shared = process.env["SITE_PIN"];
    if (shared && pinMatches(data.pin, shared)) {
      const session = await gateSession();
      await session.update({ unlocked: true, name: "Equipa Qualidade", role: "" });
      return { ok: true as const, name: "Equipa Qualidade" };
    }

    return { ok: false as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const { gateSession } = await import("./gate.server");
  const session = await gateSession();
  await session.clear();
  return { ok: true as const };
});

export const gateStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isUnlocked, currentUser } = await import("./gate.server");
  return { unlocked: await isUnlocked(), user: await currentUser() };
});
