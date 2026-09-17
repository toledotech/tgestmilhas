export async function listAdminUsers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, name, email, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createAdminUser({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}) {
  if (!email || !password) throw new Error("email e senha são obrigatórios");
  if (password.length < 8) throw new Error("a senha precisa ter pelo menos 8 caracteres");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(createErr.message);

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .insert({ id: created.user.id, email, name: name || null })
    .select("id, name, email, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAdminUser(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (authErr) throw new Error(authErr.message);
  const { error } = await supabaseAdmin.from("admin_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
