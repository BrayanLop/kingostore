const formatoCop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatearCop(valor: number): string {
  return formatoCop.format(valor);
}

// ---------------------------------------------------------------- reglas

export interface ReglaPrecio {
  alcance: "global" | "categoria" | "producto";
  categoriaId?: string | null;
  productoId?: string | null;
  /** Margen mínimo sobre el PRECIO DE VENTA, en %. 35 = ganas 35 de cada 100 vendidos. */
  margenMin: number;
  /** El precio se redondea hacia arriba al múltiplo de este valor (COP). */
  redondeo: number;
}

/** Se usa cuando no hay ninguna regla configurada en la base de datos. */
export const REGLA_POR_DEFECTO: Pick<ReglaPrecio, "margenMin" | "redondeo"> = {
  margenMin: 35,
  redondeo: 100,
};

/**
 * Precio de venta mínimo para lograr el margen pedido:
 *   precio = (costo + costosAdicionales) / (1 - margen/100), redondeado hacia arriba.
 * `costosAdicionales` sirve para costos que asumimos nosotros (flete incluido,
 * comisión de la pasarela, etc.).
 */
export function calcularPrecioVenta(opciones: {
  costo: number;
  margenMin: number;
  redondeo: number;
  costosAdicionales?: number;
}): number {
  const { costo, margenMin, redondeo, costosAdicionales = 0 } = opciones;
  if (!Number.isFinite(costo) || costo < 0) throw new RangeError("costo inválido");
  if (!Number.isFinite(margenMin) || margenMin < 0 || margenMin >= 100) {
    throw new RangeError("el margen debe estar entre 0 y 100 (sin incluir 100)");
  }
  if (!Number.isInteger(redondeo) || redondeo <= 0) {
    throw new RangeError("el redondeo debe ser un entero positivo");
  }
  const base = costo + costosAdicionales;
  const crudo = base / (1 - margenMin / 100);
  return Math.ceil(crudo / redondeo - 1e-9) * redondeo;
}

/** Margen real (%) sobre el precio de venta. */
export function margenReal(
  precio: number,
  costo: number,
  costosAdicionales = 0,
): number {
  if (precio <= 0) return 0;
  return ((precio - costo - costosAdicionales) / precio) * 100;
}

/** La regla más específica gana: producto > categoría > global. */
export function resolverRegla(
  reglas: ReglaPrecio[],
  contexto: { productoId?: string | null; categoriaId?: string | null },
): Pick<ReglaPrecio, "margenMin" | "redondeo"> {
  const porProducto = contexto.productoId
    ? reglas.find(
        (r) => r.alcance === "producto" && r.productoId === contexto.productoId,
      )
    : undefined;
  const porCategoria = contexto.categoriaId
    ? reglas.find(
        (r) => r.alcance === "categoria" && r.categoriaId === contexto.categoriaId,
      )
    : undefined;
  const global = reglas.find((r) => r.alcance === "global");
  return porProducto ?? porCategoria ?? global ?? REGLA_POR_DEFECTO;
}
