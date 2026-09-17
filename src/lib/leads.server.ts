const VALID_PROFILES = new Set([
  "quase_nunca",
  "nacional_1_2",
  "internacional_1_2",
  "nacional_e_internacional_1_1",
  "frequente_4mais",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(phone: string | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    throw new Error("WhatsApp inválido");
  }
  return digits;
}

export async function saveLead({
  email,
  phone,
  profile,
}: {
  email: string;
  phone?: string;
  profile: string;
}) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error("email inválido");
  }
  const normalizedPhone = normalizePhone(phone);
  if (!profile || !VALID_PROFILES.has(profile)) {
    throw new Error("perfil de viajante inválido");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .upsert({ email, phone: normalizedPhone, profile }, { onConflict: "email" })
    .select("email, phone, profile, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getAllLeads() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("email, phone, profile, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}
