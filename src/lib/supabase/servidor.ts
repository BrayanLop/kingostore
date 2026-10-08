import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la llave de servicio: se salta RLS y tiene acceso total.
 * Solo para código de servidor (pedidos, pagos, sincronización, admin).
 * `server-only` hace fallar el build si alguien lo importa desde el navegador.
 */
export function crearClienteServicio(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
