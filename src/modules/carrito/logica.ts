// Lógica pura del carrito (sin React ni navegador): fácil de probar.

export interface LineaCarrito {
  varianteId: string;
  slug: string;
  nombre: string;
  /** Texto de la variante, ej. "Rojo, M". Vacío si no tiene. */
  detalle: string;
  /** Precio que vio el cliente. El servidor SIEMPRE recalcula con la base de datos. */
  precio: number;
  cantidad: number;
}

export const MAX_POR_LINEA = 20;

export function agregarLinea(
  carrito: LineaCarrito[],
  nueva: Omit<LineaCarrito, "cantidad">,
  cantidad = 1,
): LineaCarrito[] {
  const existente = carrito.find((l) => l.varianteId === nueva.varianteId);
  if (!existente) {
    return [...carrito, { ...nueva, cantidad: Math.min(cantidad, MAX_POR_LINEA) }];
  }
  return carrito.map((l) =>
    l.varianteId === nueva.varianteId
      ? { ...l, precio: nueva.precio, cantidad: Math.min(l.cantidad + cantidad, MAX_POR_LINEA) }
      : l,
  );
}

export function cambiarCantidad(
  carrito: LineaCarrito[],
  varianteId: string,
  cantidad: number,
): LineaCarrito[] {
  if (cantidad <= 0) return quitarLinea(carrito, varianteId);
  return carrito.map((l) =>
    l.varianteId === varianteId
      ? { ...l, cantidad: Math.min(Math.floor(cantidad), MAX_POR_LINEA) }
      : l,
  );
}

export function quitarLinea(carrito: LineaCarrito[], varianteId: string): LineaCarrito[] {
  return carrito.filter((l) => l.varianteId !== varianteId);
}

export function subtotal(carrito: LineaCarrito[]): number {
  return carrito.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
}

export function totalUnidades(carrito: LineaCarrito[]): number {
  return carrito.reduce((suma, l) => suma + l.cantidad, 0);
}

/** Lee el carrito guardado, descartando cualquier cosa con forma inválida. */
export function leerCarrito(crudo: string | null): LineaCarrito[] {
  if (!crudo) return [];
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];
  const lineas: LineaCarrito[] = [];
  for (const d of datos) {
    if (
      d &&
      typeof d.varianteId === "string" &&
      typeof d.slug === "string" &&
      typeof d.nombre === "string" &&
      typeof d.detalle === "string" &&
      Number.isInteger(d.precio) && d.precio >= 0 &&
      Number.isInteger(d.cantidad) && d.cantidad > 0 && d.cantidad <= MAX_POR_LINEA
    ) {
      lineas.push({
        varianteId: d.varianteId, slug: d.slug, nombre: d.nombre,
        detalle: d.detalle, precio: d.precio, cantidad: d.cantidad,
      });
    }
  }
  return lineas;
}
