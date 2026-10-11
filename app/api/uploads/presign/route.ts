import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadRequestSchema } from "@/lib/validation";

const imageBucket = "medication-images";

export async function POST(request: Request) {
  const { user, response } = await requireAppUser();
  if (!user) return response;
  const parsed = uploadRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_UPLOAD_REQUEST" }, { status: 400 });

  const extension = parsed.data.mimeType === "image/jpeg" ? "jpg" : parsed.data.mimeType.split("/")[1];
  const storagePath = `${user.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const database = createSupabaseAdminClient();
  const { data: image, error: imageError } = await database
    .from("uploaded_images")
    .insert({ owner_id: user.id, storage_path: storagePath, mime_type: parsed.data.mimeType, byte_size: parsed.data.byteSize, sha256: parsed.data.sha256 })
    .select("id")
    .single();
  if (imageError || !image) return NextResponse.json({ error: "UPLOAD_METADATA_CREATE_FAILED" }, { status: 500 });

  const { data: upload, error: uploadError } = await database.storage.from(imageBucket).createSignedUploadUrl(storagePath);
  if (uploadError || !upload) {
    await database.from("uploaded_images").delete().eq("id", image.id);
    return NextResponse.json({ error: "UPLOAD_URL_CREATE_FAILED" }, { status: 500 });
  }
  await database.from("audit_logs").insert({ actor_id: user.id, action: "IMAGE_UPLOAD_REQUESTED", entity_type: "uploaded_images", entity_id: image.id });
  return NextResponse.json({ imageId: image.id, storagePath, token: upload.token, signedUrl: upload.signedUrl });
}