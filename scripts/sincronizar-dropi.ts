// Trae productos de Dropi a nuestra base de datos.
//
//   npm run dropi:sincronizar -- --categorias=Hogar,Cocina,Mascotas --max=30 --solo-listar
//   npm run dropi:sincronizar -- --categorias=Hogar,Cocina,Mascotas --max=30
//
// --solo-listar: lee de Dropi y muestra qué importaría, SIN escribir en la base.
// Los productos nuevos quedan en BORRADOR: hay que revisarlos y publicarlos.
// Requiere DROPI_TOKEN (y, para escribir, las claves de Supabase) en .env.local.
import { createClient } from "@supabase/supabase-js";
import { AdaptadorDropi } from "../src/modules/proveedores/dropi";
import { crearRepositorioSupabase } from "../src/modules/sincronizacion/repositorio-supabase";
import { sincronizarProveedor } from "../src/modules/sincronizacion/sincronizar";

function opcion(nombre: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a?.slice(nombre.length + 3);
}

async function main() {
  const soloListar = process.argv.includes("--solo-listar");
  const categorias = opcion("categorias")?.split(",").map((c) => c.trim()).filter(Boolean);
  const maxPorCategoria = opcion("max") ? Number(opcion("max")) : 30;
  if (!Number.isInteger(maxPorCategoria) || maxPorCategoria < 1) {
    throw new Error("--max debe ser un entero positivo");
  }

  const token = process.env.DROPI_TOKEN;
  if (!token) throw new Error("Falta DROPI_TOKEN en .env.local.");
  const adaptador = new AdaptadorDropi({
    token,
    baseUrl: process.env.DROPI_API_URL,
    categorias,
    maxPorCategoria,
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
        } else if (n <= 15) {
          const v = p.variantes;
          console.log(`  ✔ ${p.idExterno} ${p.nombre} · ${v.length} variante(s) · costo desde ${Math.min(...v.map((x) => x.costo))} · ${p.imagenes.length} foto(s)`);
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
    .upsert({ slug: "dropi", nombre: "Dropi", tipo: "api" }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo registrar el proveedor: ${error.message}`);

  const r = await sincronizarProveedor(adaptador, proveedor.id, crearRepositorioSupabase(db));
  console.log("Sincronización con Dropi terminada:");
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
