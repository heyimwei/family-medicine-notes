import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createUserSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { user: admin, response } = await requireAdmin();
  if (!admin) return response;
  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_USER_REQUEST" }, { status: 400 });
  const database = createSupabaseAdminClient();
  const { data, error } = await database.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true });
  if (error || !data.user) return NextResponse.json({ error: "USER_CREATE_FAILED" }, { status: 409 });
  const { error: profileError } = await database.from("profiles").insert({ id: data.user.id, role: "USER", display_name: parsed.data.displayName });
  if (profileError) {
    await database.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "PROFILE_CREATE_FAILED" }, { status: 500 });
  }
  await database.from("audit_logs").insert({ actor_id: admin.id, action: "USER_CREATED", entity_type: "profiles", entity_id: data.user.id });
  return NextResponse.json({ id: data.user.id, displayName: parsed.data.displayName }, { status: 201 });
}
