import MedicationWorkspace from "@/components/medication-workspace";
import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { hasSupabaseConfiguration } from "@/lib/env";

export default async function Home() {
  if (!hasSupabaseConfiguration()) return <MedicationWorkspace demoMode />;
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");
  return <MedicationWorkspace demoMode={false} user={user} />;
}
