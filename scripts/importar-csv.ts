// Importa el catálogo de un proveedor desde un archivo CSV.
//
//   npm run importar:csv -- <archivo.csv> <slug-del-proveedor> [--solo-validar]
//
// Con --solo-validar solo lee y valida el archivo; no toca la base de datos.
// Los productos nuevos quedan en BORRADOR: hay que revisarlos y publicarlos.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { AdaptadorCsv } from "../src/modules/proveedores/csv";
import { crearRepositorioSupabase } from "../src/modules/sincronizacion/repositorio-supabase";
import { sincronizarProveedor } from "../src/modules/sincronizacion/sincronizar";

async function main() {
  const args = process.argv.slice(2);
  const soloValidar = args.includes("--solo-validar");
  const [archivo, slug] = args.filter((a) => !a.startsWith("--"));
  if (!archivo || (!slug && !soloValidar)) {
    console.error("Uso: npm run importar:csv -- <archivo.csv> <slug-del-proveedor> [--solo-validar]");
    process.exit(1);
  }

  const adaptador = new AdaptadorCsv(slug ?? "validacion", readFileSync(archivo, "utf8"));
  const { productos } = await adaptador.listarProductos();
  const variantes = productos.reduce((n, p) => n + p.variantes.length, 0);
  console.log(`Archivo válido: ${productos.length} productos, ${variantes} variantes.`);
  if (soloValidar) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa --env-file=.env.local).");
  }
  const db = createClient(url, clave, { auth: { persistSession: false } });

  const { data: proveedor, error } = await db
    .from("proveedores")
    .upsert({ slug, nombre: slug, tipo: "csv" }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo registrar el proveedor: ${error.message}`);

  const r = await sincronizarProveedor(adaptador, proveedor.id, crearRepositorioSupabase(db));
  console.log("Sincronización terminada:");
  console.log(`  productos creados (borrador): ${r.productosCreados}`);
  console.log(`  productos actualizados:       ${r.productosActualizados}`);
  console.log(`  variantes creadas:            ${r.variantesCreadas}`);
  console.log(`  variantes actualizadas:       ${r.variantesActualizadas}`);
  console.log(`  variantes sin stock:          ${r.variantesSinStock}`);
  console.log(`  errores:                      ${r.errores}`);
  for (const e of r.detalleErrores) console.log(`    - ${e.idExterno}: ${e.mensaje}`);
  if (r.errores > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
