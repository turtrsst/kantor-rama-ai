import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function getServiceClient() {
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(sUrl, sKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
