// Trae a nuestra base los productos DROPSHIP que agregaste a tu tienda de Venndelo.
//
//   npm run venndelo:sincronizar -- --solo-listar     (solo muestra, no escribe en la base)
//   npm run venndelo:sincronizar                      (escribe en la base)
//
// Los productos nuevos quedan en BORRADOR. Esta API no entrega imágenes: se agregan
// aparte. Requiere VENNDELO_REFRESH_TOKEN (y las claves de Supabase para escribir).
import { createClient } from "@supabase/supabase-js";
import { AdaptadorVenndelo } from "../src/modules/proveedores/venndelo";
import { crearRepositorioSupabase } from "../src/modules/sincronizacion/repositorio-supabase";
import { sincronizarProveedor } from "../src/modules/sincronizacion/sincronizar";
import { crearAlmacenEnv } from "./almacen-env";

async function main() {
  const soloListar = process.argv.includes("--solo-listar");
  if (!process.env.VENNDELO_REFRESH_TOKEN) throw new Error("Falta VENNDELO_REFRESH_TOKEN en .env.local.");
  const adaptador = new AdaptadorVenndelo({
    almacenToken: crearAlmacenEnv("VENNDELO_REFRESH_TOKEN"),
    baseUrl: process.env.VENNDELO_API_URL,
  });

  if (soloListar) {
    let n = 0;
    let rechazados = 0;
    for (let pagina = 1; pagina <= 200; pagina++) {
      const { productos, hayMas } = await adaptador.listarProductos();
      for (const p of productos) {
        n++;
        if (p.motivoRechazo) {
          rechazados++;
          console.log(`  ✘ ${p.idExterno} ${p.nombre}: ${p.motivoRechazo}`);
        } else {
          for (const v of p.variantes) {
            const atr = Object.values(v.atributos).join("/") || "única";
            console.log(`  ✔ ${p.idExterno} ${p.nombre} [${atr}] · costo ${v.costo} · sugerido ${v.precioSugerido ?? "—"} · stock ${v.stock}`);
          }
        }
      }
      if (!hayMas) break;
    }
    console.log(`\nLeídos ${n} productos (${rechazados} rechazados). No se escribió nada en la base.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan las claves de Supabase en .env.local.");
  const db = createClient(url, clave, { auth: { persistSession: false } });

  const { data: proveedor, error } = await db
    .from("proveedores")
    .upsert({ slug: "venndelo", nombre: "Venndelo", tipo: "api" }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo registrar el proveedor: ${error.message}`);

  const r = await sincronizarProveedor(adaptador, proveedor.id, crearRepositorioSupabase(db));
  console.log("Sincronización con Venndelo terminada:");
  console.log(`  productos creados (borrador): ${r.productosCreados}`);
  console.log(`  productos actualizados:       ${r.productosActualizados}`);
  console.log(`  variantes creadas:            ${r.variantesCreadas}`);
  console.log(`  variantes actualizadas:       ${r.variantesActualizadas}`);
  console.log(`  variantes sin stock:          ${r.variantesSinStock}`);
  console.log(`  errores:                      ${r.errores}`);
  for (const e of r.detalleErrores.slice(0, 20)) console.log(`    - ${e.idExterno}: ${e.mensaje}`);
  if (r.errores > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
