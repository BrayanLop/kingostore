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

export interface Variante {
  id: string;
  /** Ej.: { Color: "Rojo", Talla: "M" }. Vacío si el producto no tiene variantes. */
  atributos: Record<string, string>;
  /** Precio de venta en pesos colombianos (COP), sin decimales. */
  precio: number;
  stock: number;
}

export interface Producto {
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaSlug;
  /** Precio más bajo entre las variantes ("desde"). */
  precio: number;
  variantes: Variante[];
  /** Producto de demostración: se reemplaza por datos reales de los proveedores. */
  demo: boolean;
}
