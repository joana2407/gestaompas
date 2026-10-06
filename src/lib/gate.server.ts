import { redirect } from "@tanstack/react-router";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean; name?: string; role?: string; userId?: string };

export type TeamMember = { pin: string; name: string; role: string };

/** Personal PINs, one per quality-team member. */
export function teamMembers(): TeamMember[] {
  const raw = process.env["TEAM_PINS"];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TeamMember[];
    return Array.isArray(parsed) ? parsed.filter((m) => m?.pin && m?.name) : [];
  } catch {
    console.error("TEAM_PINS não é um JSON válido.");
    return [];
  }
}

function sessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("SESSION_SECRET não está configurado.");
  return {
    password,
    name: "rasff-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function gateSession() {
  return useSession<GateSession>(sessionConfig());
}

export async function isUnlocked(): Promise<boolean> {
  const session = await gateSession();
  return session.data.unlocked === true;
}

export async function currentUser(): Promise<{ name: string; role: string; permissions: string[] } | null> {
  const session = await gateSession();
  if (session.data.unlocked !== true) return null;
  const name = session.data.name ?? "Equipa Qualidade";
  let permissions: string[] = [];
  if (session.data.userId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("team_users")
      .select("permissions, active, role, name")
      .eq("id", session.data.userId)
      .maybeSingle();
    if (!data || !data.active) return null;
    permissions = data.permissions;
    return { name: data.name, role: data.role, permissions };
  }
  return { name, role: session.data.role ?? "", permissions };
}

/** Throws a redirect to the PIN screen unless this browser has unlocked the site. */
export async function requireUnlocked(): Promise<void> {
  if (!(await isUnlocked())) throw redirect({ to: "/entrar" });
}

export async function requirePermission(permission: string) {
  const user = await currentUser();
  if (!user) throw redirect({ to: "/entrar" });
  if (!user.permissions.includes(permission)) throw new Error("Sem permissão para esta ação.");
  return user;
}

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

/** Hash both sides first: timingSafeEqual throws on length mismatch. */
export function pinMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
