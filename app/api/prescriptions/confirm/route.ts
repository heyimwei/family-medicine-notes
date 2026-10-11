import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prescriptionConfirmationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { user, response } = await requireAppUser();
  if (!user) return response;
  const parsed = prescriptionConfirmationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CONFIRMATION_REQUEST" }, { status: 400 });
  const database = createSupabaseAdminClient();

  const { data: ownedImages, error: imageError } = await database.from("uploaded_images").select("id").eq("owner_id", user.id).in("id", parsed.data.imageIds).is("deleted_at", null);
  if (imageError || ownedImages.length !== parsed.data.imageIds.length) return NextResponse.json({ error: "IMAGE_OWNERSHIP_INVALID" }, { status: 403 });

  const { data: encounter, error: encounterError } = await database.from("encounters")
    .insert({ owner_id: user.id, visit_date: parsed.data.visitDate, reason: parsed.data.reason, department: parsed.data.department, instructions: parsed.data.instructions })
    .select("id").single();
  if (encounterError || !encounter) return NextResponse.json({ error: "ENCOUNTER_CREATE_FAILED" }, { status: 500 });

  const { data: prescription, error: prescriptionError } = await database.from("prescriptions")
    .insert({ encounter_id: encounter.id, status: "CONFIRMED", confirmed_at: new Date().toISOString(), confirmed_by: user.id })
    .select("id").single();
  if (prescriptionError || !prescription) return NextResponse.json({ error: "PRESCRIPTION_CREATE_FAILED" }, { status: 500 });

  const { error: itemError } = await database.from("prescription_items").insert(parsed.data.items.map((item) => ({
    prescription_id: prescription.id,
    entered_name: item.enteredName,
    dose_text: item.doseText,
    frequency_text: item.frequencyText,
    duration_days: item.durationDays,
    notes: item.notes,
    drug_reference_id: item.drugReferenceId,
    verification_status: item.drugReferenceId ? "CONFIRMED" : "NEEDS_REVIEW",
  })));
  if (itemError) return NextResponse.json({ error: "PRESCRIPTION_ITEM_CREATE_FAILED" }, { status: 500 });
  await database.from("uploaded_images").update({ encounter_id: encounter.id }).in("id", parsed.data.imageIds);
  await database.from("audit_logs").insert({ actor_id: user.id, action: "PRESCRIPTION_CONFIRMED", entity_type: "prescriptions", entity_id: prescription.id });
  return NextResponse.json({ prescriptionId: prescription.id }, { status: 201 });
}