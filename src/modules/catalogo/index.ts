// Interfaz pública del módulo de catálogo. El resto de la aplicación solo
// importa desde aquí. Lee de Supabase; si no está configurado (desarrollo sin
// base de datos) usa los datos de demostración.
import { cacheLife, cacheTag } from "next/cache";
import { crearClientePublico } from "@/lib/supabase/publico";
import { categorias, productos } from "./datos-demo";
import {
  categoriasDesdeSupabase,
  productoDesdeSupabase,
  productosDesdeSupabase,
} from "./repositorio-supabase";
import type { Categoria, CategoriaSlug, Producto } from "./types";

export type { Categoria, CategoriaSlug, Producto, Variante } from "./types";

let avisoDemoMostrado = false;

function clienteOAviso() {
  const db = crearClientePublico();
  if (!db && !avisoDemoMostrado) {
    avisoDemoMostrado = true;
    console.warn(
      "[catalogo] Supabase no está configurado: usando datos de demostración.",
    );
  }
  return db;
}

export async function listarCategorias(): Promise<Categoria[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogo");
  const db = clienteOAviso();
  return db ? categoriasDesdeSupabase(db) : categorias;
}

export async function obtenerCategoria(
  slug: string,
): Promise<Categoria | undefined> {
  const todas = await listarCategorias();
  return todas.find((c) => c.slug === slug);
}

export async function listarProductos(
  categoria?: CategoriaSlug,
): Promise<Producto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogo");
  const db = clienteOAviso();
  if (db) return productosDesdeSupabase(db, categoria);
  return categoria ? productos.filter((p) => p.categoria === categoria) : productos;
}

export async function obtenerProducto(
  slug: string,
): Promise<Producto | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogo");
  const db = clienteOAviso();
  return db
    ? productoDesdeSupabase(db, slug)
    : productos.find((p) => p.slug === slug);
}
