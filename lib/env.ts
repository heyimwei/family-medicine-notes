import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(20),
});

export function hasSupabaseConfiguration() {
  return publicEnvironmentSchema.safeParse(process.env).success;
}

export function getPublicEnvironment() {
  return publicEnvironmentSchema.parse(process.env);
}

export function getServerEnvironment() {
  return serverEnvironmentSchema.parse(process.env);
}