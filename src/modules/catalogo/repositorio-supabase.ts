import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria, CategoriaSlug, Producto } from "./types";

// Lecturas del catálogo público. Usa la clave anon: las políticas RLS ya limitan
// el resultado a productos activos y a columnas sin costo ni proveedor.

interface FilaCategoria {
  slug: CategoriaSlug;
  nombre: string;
  descripcion: string;
}

interface FilaProducto {
  slug: string;
  nombre: string;
  descripcion: string;
  demo: boolean;
  categorias: { slug: CategoriaSlug } | null;
  variantes: { precio_venta: number }[];
}

const COLUMNAS_PRODUCTO =
  "slug, nombre, descripcion, demo, categorias!inner(slug), variantes(precio_venta)";

function aProducto(fila: FilaProducto): Producto | null {
  // Un producto sin variantes activas no se puede vender: no se muestra.
  if (!fila.categorias || fila.variantes.length === 0) return null;
  return {
    slug: fila.slug,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    categoria: fila.categorias.slug,
    precio: Math.min(...fila.variantes.map((v) => v.precio_venta)),
    demo: fila.demo,
  };
}

export async function categoriasDesdeSupabase(
  db: SupabaseClient,
): Promise<Categoria[]> {
  const { data, error } = await db
    .from("categorias")
    .select("slug, nombre, descripcion")
    .order("orden");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return (data ?? []) as FilaCategoria[];
}

export async function productosDesdeSupabase(
  db: SupabaseClient,
  categoria?: CategoriaSlug,
): Promise<Producto[]> {
  let consulta = db.from("productos").select(COLUMNAS_PRODUCTO).order("nombre");
  if (categoria) consulta = consulta.eq("categorias.slug", categoria);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
  return ((data ?? []) as unknown as FilaProducto[])
    .map(aProducto)
    .filter((p): p is Producto => p !== null);
}

export async function productoDesdeSupabase(
  db: SupabaseClient,
  slug: string,
): Promise<Producto | undefined> {
  const { data, error } = await db
    .from("productos")
    .select(COLUMNAS_PRODUCTO)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el producto: ${error.message}`);
  return data ? (aProducto(data as unknown as FilaProducto) ?? undefined) : undefined;
}
