/** Hash corto y estable (FNV-1a) para que dos productos con el mismo nombre no choquen. */
function hashCorto(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

/** slug legible + sufijo derivado del id del proveedor: estable entre sincronizaciones. */
export function crearSlug(nombre: string, idExterno: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "producto"}-${hashCorto(idExterno)}`;
}
