import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { user, response } = await requireAppUser();
  if (!user) return response;

  const database = createSupabaseAdminClient();
  // Service-role queries bypass RLS, so resolve the caller's prescription IDs before fetching items.
  const { data: ownedPrescriptions, error: ownershipError } = await database
    .from("prescriptions")
    .select("id, encounters!inner(owner_id, deleted_at)")
    .eq("status", "CONFIRMED")
    .eq("encounters.owner_id", user.id)
    .is("encounters.deleted_at", null);
  if (ownershipError) return NextResponse.json({ error: "MEDICATION_QUERY_FAILED" }, { status: 500 });

  const prescriptionIds = (ownedPrescriptions ?? []).map((prescription) => prescription.id);
  if (prescriptionIds.length === 0) return NextResponse.json({ medications: [] });
  const { data: medications, error: medicationError } = await database
    .from("prescription_items")
    .select("id, entered_name, dose_text, frequency_text, verification_status, drug_references(name_en, indications, source_url)")
    .in("prescription_id", prescriptionIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (medicationError) return NextResponse.json({ error: "MEDICATION_QUERY_FAILED" }, { status: 500 });
  return NextResponse.json({ medications });
}