import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { getServerEnvironment } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type VisionOutput = {
  medications: Array<{ name: string; doseText?: string; frequencyText?: string; durationDays?: number; notes?: string }>;
  unreadableAreas: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

const responseFormat = {
  type: "json_schema",
  name: "prescription_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["medications", "unreadableAreas", "confidence"],
    properties: {
      medications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string" }, doseText: { type: "string" }, frequencyText: { type: "string" },
            durationDays: { type: "integer" }, notes: { type: "string" },
          },
        },
      },
      unreadableAreas: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    },
  },
};

export async function POST(request: Request) {
  const { user, response } = await requireAppUser();
  if (!user) return response;
  const body = await request.json().catch(() => null) as { imageIds?: unknown } | null;
  const imageIds = Array.isArray(body?.imageIds) ? body.imageIds.filter((id): id is string => typeof id === "string") : [];
  if (imageIds.length === 0 || imageIds.length > 5) return NextResponse.json({ error: "INVALID_IMAGE_IDS" }, { status: 400 });

  const database = createSupabaseAdminClient();
  const { data: images, error: imageError } = await database.from("uploaded_images")
    .select("id, storage_path, mime_type").eq("owner_id", user.id).in("id", imageIds).is("deleted_at", null);
  if (imageError || images.length !== imageIds.length) return NextResponse.json({ error: "IMAGE_OWNERSHIP_INVALID" }, { status: 403 });

  const jobRows = images.map((image) => ({ image_id: image.id, owner_id: user.id, status: "PROCESSING", model: "gpt-4.1-mini" }));
  const { data: jobs, error: jobError } = await database.from("extraction_jobs").insert(jobRows).select("id, image_id");
  if (jobError || !jobs) return NextResponse.json({ error: "EXTRACTION_JOB_CREATE_FAILED" }, { status: 500 });

  try {
    const environment = getServerEnvironment();
    const inputs = await Promise.all(images.map(async (image) => {
      const { data: blob, error } = await database.storage.from("medication-images").download(image.storage_path);
      if (error || !blob) throw new Error("IMAGE_DOWNLOAD_FAILED");
      const bytes = Buffer.from(await blob.arrayBuffer()).toString("base64");
      return { type: "input_image", image_url: `data:${image.mime_type};base64,${bytes}`, detail: "high" };
    }));
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${environment.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [
          { type: "input_text", text: "請只逐字擷取台灣藥袋或處方箋上明確可見的藥名、劑量、頻率、天數與備註。不可猜測、不可診斷、不可建議調藥；看不清楚就列入 unreadableAreas。" },
          ...inputs,
        ] }],
        text: { format: responseFormat },
        store: false,
      }),
    });
    if (!openAiResponse.ok) throw new Error("OPENAI_REQUEST_FAILED");
    const payload = await openAiResponse.json() as { output_text?: string };
    const result = JSON.parse(payload.output_text ?? "") as VisionOutput;
    await Promise.all(jobs.map((job) => database.from("extraction_jobs").update({ status: "SUCCEEDED", result, completed_at: new Date().toISOString() }).eq("id", job.id)));
    await database.from("audit_logs").insert({ actor_id: user.id, action: "IMAGE_EXTRACTION_SUCCEEDED", entity_type: "extraction_jobs" });
    return NextResponse.json({ result, jobs });
  } catch {
    await Promise.all(jobs.map((job) => database.from("extraction_jobs").update({ status: "FAILED", error_code: "EXTRACTION_FAILED", completed_at: new Date().toISOString() }).eq("id", job.id)));
    return NextResponse.json({ error: "EXTRACTION_FAILED" }, { status: 502 });
  }
}
