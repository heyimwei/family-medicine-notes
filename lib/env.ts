import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(20),
});

// Next.js only exposes NEXT_PUBLIC_* values to browser bundles when they are
// referenced directly. Parsing the complete process.env object works on the
// server but leaves browser-side configuration empty.
function publicEnvironmentInput() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function serverEnvironmentInput() {
  return {
    ...publicEnvironmentInput(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
}

export function hasSupabaseConfiguration() {
  return publicEnvironmentSchema.safeParse(publicEnvironmentInput()).success;
}

export function getPublicEnvironment() {
  return publicEnvironmentSchema.parse(publicEnvironmentInput());
}

export function getServerEnvironment() {
  return serverEnvironmentSchema.parse(serverEnvironmentInput());
}
