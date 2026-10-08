import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave pública (anon). Solo puede leer lo que las políticas RLS
 * permiten: catálogo activo, sin costos ni datos del proveedor.
 * Devuelve null si Supabase no está configurado (desarrollo sin base de datos).
 */
export function crearClientePublico(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
