// Reglas de envío. VALORES PROVISIONALES: se ajustan cuando se conozcan los
// fletes reales del proveedor (Dropi) y se decida la política de envío gratis.

/** Flete fijo en COP. */
export const FLETE_FIJO_COP = 12_000;

/** Subtotal desde el cual el envío es gratis (COP). null = nunca es gratis. */
export const ENVIO_GRATIS_DESDE_COP: number | null = 150_000;

export function calcularFlete(subtotal: number): number {
  if (ENVIO_GRATIS_DESDE_COP !== null && subtotal >= ENVIO_GRATIS_DESDE_COP) {
    return 0;
  }
  return FLETE_FIJO_COP;
}

export const DEPARTAMENTOS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar",
  "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó",
  "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
  "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío",
  "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
  "Valle del Cauca", "Vaupés", "Vichada",
] as const;
