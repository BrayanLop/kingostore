import type {
  AdaptadorProveedor,
  ProductoProveedor,
  VarianteProveedor,
} from "./types";

// Importador por CSV para proveedores sin API.
//
// Columnas (la primera fila es el encabezado; el orden no importa):
//   id_externo   obligatoria. Código del producto en el proveedor.
//   nombre       obligatoria.
//   costo        obligatoria. Entero en COP, solo dígitos (ej. 24500).
//   stock        obligatoria. Entero >= 0.
//   descripcion  opcional.
//   imagenes     opcional. URLs separadas por |
//   variante_id  opcional. Si el producto tiene varias filas (una por talla/color),
//                cada una necesita el suyo. Si falta, se usa id_externo.
//   atributos    opcional. Ej.: Color:Rojo;Talla:M
// Acepta coma o punto y coma como separador (Excel en español usa punto y coma).

export class ErrorCsv extends Error {
  constructor(
    mensaje: string,
    readonly linea?: number,
  ) {
    super(linea ? `Línea ${linea}: ${mensaje}` : mensaje);
    this.name = "ErrorCsv";
  }
}

/** Divide el texto en filas de celdas, respetando comillas y saltos de línea dentro de ellas. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? "";
  const separador =
    primeraLinea.includes(";") && !primeraLinea.includes(",") ? ";" : ",";

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        enComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === separador) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      celda = "";
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else {
      celda += c;
    }
  }
  if (enComillas) throw new ErrorCsv("hay unas comillas sin cerrar");
  fila.push(celda);
  if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  return filas;
}

function entero(valor: string, campo: string, linea: number): number {
  if (!/^\d+$/.test(valor.trim())) {
    throw new ErrorCsv(
      `"${campo}" debe ser un número entero sin puntos ni símbolos (recibido: "${valor}")`,
      linea,
    );
  }
  return Number(valor.trim());
}

function parsearAtributos(valor: string, linea: number): Record<string, string> {
  const atributos: Record<string, string> = {};
  for (const par of valor.split(";").map((p) => p.trim()).filter(Boolean)) {
    const i = par.indexOf(":");
    if (i <= 0 || i === par.length - 1) {
      throw new ErrorCsv(`atributo inválido "${par}" (usa Nombre:Valor)`, linea);
    }
    atributos[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  return atributos;
}

/** Convierte el CSV en productos con variantes. Falla con el número de línea si algo está mal. */
export function productosDesdeCsv(texto: string): ProductoProveedor[] {
  const filas = parsearCsv(texto);
  if (filas.length < 2) throw new ErrorCsv("el archivo no tiene datos");

  const encabezado = filas[0].map((h) => h.trim().toLowerCase());
  const col = (nombre: string) => encabezado.indexOf(nombre);
  for (const obligatoria of ["id_externo", "nombre", "costo", "stock"]) {
    if (col(obligatoria) === -1) {
      throw new ErrorCsv(`falta la columna obligatoria "${obligatoria}"`);
    }
  }
  const dato = (fila: string[], nombre: string) =>
    (col(nombre) === -1 ? "" : (fila[col(nombre)] ?? "")).trim();

  const porId = new Map<string, ProductoProveedor>();
  const variantesVistas = new Set<string>();

  filas.slice(1).forEach((fila, i) => {
    const linea = i + 2;
    const idExterno = dato(fila, "id_externo");
    const nombre = dato(fila, "nombre");
    if (!idExterno) throw new ErrorCsv('"id_externo" está vacío', linea);
    if (!nombre) throw new ErrorCsv('"nombre" está vacío', linea);

    const variante: VarianteProveedor = {
      idExterno: dato(fila, "variante_id") || idExterno,
      atributos: parsearAtributos(dato(fila, "atributos"), linea),
      costo: entero(dato(fila, "costo"), "costo", linea),
      stock: entero(dato(fila, "stock"), "stock", linea),
    };
    const clave = `${idExterno}\u0000${variante.idExterno}`;
    if (variantesVistas.has(clave)) {
      throw new ErrorCsv(
        `la variante "${variante.idExterno}" del producto "${idExterno}" está repetida`,
        linea,
      );
    }
    variantesVistas.add(clave);

    const existente = porId.get(idExterno);
    if (existente) {
      existente.variantes.push(variante);
    } else {
      porId.set(idExterno, {
        idExterno,
        nombre,
        descripcion: dato(fila, "descripcion"),
        imagenes: dato(fila, "imagenes").split("|").map((u) => u.trim()).filter(Boolean),
        variantes: [variante],
      });
    }
  });

  return [...porId.values()];
}

/** Adaptador de proveedor basado en un CSV ya leído. Todo llega en una sola página. */
export class AdaptadorCsv implements AdaptadorProveedor {
  private readonly productos: ProductoProveedor[];

  constructor(
    readonly id: string,
    texto: string,
  ) {
    this.productos = productosDesdeCsv(texto);
  }

  async listarProductos() {
    return { productos: this.productos, hayMas: false };
  }

  async obtenerStock(idExternoVariante: string): Promise<number> {
    for (const p of this.productos) {
      const v = p.variantes.find((x) => x.idExterno === idExternoVariante);
      if (v) return v.stock;
    }
    return 0;
  }

  async crearPedido(): Promise<never> {
    throw new Error(
      "Este proveedor se maneja por CSV: los pedidos se envían manualmente.",
    );
  }
}
