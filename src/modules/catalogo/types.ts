export type CategoriaSlug =
  | "hogar-y-cocina"
  | "tecnologia"
  | "mascotas"
  | "belleza"
  | "fitness";

export interface Categoria {
  slug: CategoriaSlug;
  nombre: string;
  descripcion: string;
}

export interface Producto {
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaSlug;
  /** Precio de venta en pesos colombianos (COP), sin decimales. */
  precio: number;
  /** Producto de demostración: se reemplaza por datos reales de los proveedores. */
  demo: boolean;
}
