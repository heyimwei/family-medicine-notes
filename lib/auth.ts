import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = { id: string; displayName: string; role: "ADMIN" | "USER" };

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("display_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) return null;
  return { id: user.id, displayName: profile.display_name, role: profile.role };
}

export async function requireAppUser() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return { user: null, response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  }
  return { user: appUser, response: null };
}

export async function requireAdmin() {
  const result = await requireAppUser();
  if (!result.user || result.user.role !== "ADMIN") {
    return { user: null, response: result.response ?? NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  return result;
}