import { redirect } from "next/navigation";
import { configured, supabase } from "./supabase/server";
export async function viewer() {
  if (!configured()) return null;
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data: profile } = await client
    .from("profiles")
    .select("name,role")
    .eq("id", user.id)
    .single();
  const { data: admin } = await client.rpc("is_admin");
  return { user, profile, admin: admin === true };
}
export async function requireUser() {
  const v = await viewer();
  if (!v) redirect("/auth");
  return v;
}
export async function requireAdmin() {
  const v = await requireUser();
  if (!v.admin) redirect("/applications");
  return v;
}
