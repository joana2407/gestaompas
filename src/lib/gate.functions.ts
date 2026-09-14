import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ pin: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { gateSession, pinMatches } = await import("./gate.server");
    const expected = process.env["SITE_PIN"];
    if (!expected) throw new Error("O PIN de acesso não está configurado.");

    if (!pinMatches(data.pin, expected)) return { ok: false as const };

    const session = await gateSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const { gateSession } = await import("./gate.server");
  const session = await gateSession();
  await session.clear();
  return { ok: true as const };
});

export const gateStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isUnlocked } = await import("./gate.server");
  return { unlocked: await isUnlocked() };
});
