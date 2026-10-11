import { z } from "zod";

export const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(160).regex(/^[^\\/]+$/),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().positive().max(10 * 1024 * 1024),
  sha256: z.string().regex(/^[A-Fa-f0-9]{64}$/),
});

export const prescriptionConfirmationSchema = z.object({
  visitDate: z.string().date().optional(),
  reason: z.string().max(500).optional(),
  department: z.string().max(120).optional(),
  instructions: z.string().max(2000).optional(),
  imageIds: z.array(z.string().uuid()).max(5),
  items: z.array(z.object({
    enteredName: z.string().trim().min(1).max(200),
    doseText: z.string().trim().max(200).optional(),
    frequencyText: z.string().trim().max(200).optional(),
    durationDays: z.number().int().positive().max(3650).optional(),
    notes: z.string().trim().max(1000).optional(),
    drugReferenceId: z.string().uuid().optional(),
  })).min(1).max(50),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(80),
});