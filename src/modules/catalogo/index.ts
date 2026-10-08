// Interfaz pública del módulo de catálogo. El resto de la aplicación solo
// importa desde aquí, de modo que la fuente de datos (hoy datos de demostración,
// luego Supabase + proveedores) se pueda cambiar sin tocar las páginas.
import { categorias, productos } from "./datos-demo";
import type { Categoria, CategoriaSlug, Producto } from "./types";

export type { Categoria, CategoriaSlug, Producto } from "./types";

export async function listarCategorias(): Promise<Categoria[]> {
  return categorias;
}

export async function obtenerCategoria(
  slug: string,
): Promise<Categoria | undefined> {
  return categorias.find((c) => c.slug === slug);
}

export async function listarProductos(
  categoria?: CategoriaSlug,
): Promise<Producto[]> {
  return categoria
    ? productos.filter((p) => p.categoria === categoria)
    : productos;
}

export async function obtenerProducto(
  slug: string,
): Promise<Producto | undefined> {
  return productos.find((p) => p.slug === slug);
}
