import type {
  AdaptadorProveedor,
  ProductoProveedor,
  VarianteProveedor,
} from "./types";

// Adaptador de Dropi (Colombia) por la API de integraciones.
//
// Qué está verificado y qué no (8-oct-2026):
//  · URL base, encabezado `dropi-integration-key` y la ruta POST products/index
//    salen del código del plugin de WooCommerce de Dropi y de la especificación en
//    api.dropi.co/docs. La API responde, pero con el token actual contesta 401 hasta
//    que Dropi registre la IP/dominio del servidor.
//  · La FORMA de los productos (sale_price, suggested_price, stock, gallery,
//    variations...) se tomó de lo que devuelve el conector MCP de Dropi. Es muy
//    probable que sea la misma que la de la API REST, pero NO está probada contra
//    ella: la primera sincronización real debe revisarse.
//  · Crear pedidos NO está implementado a propósito: es una acción con costo real y
//    hay que probarla antes contra el ambiente de pruebas de Dropi.

const BASE_POR_DEFECTO = "https://api.dropi.co/integrations/";

export interface OpcionesDropi {
  token: string;
  baseUrl?: string;
  /** Productos por petición (el conector acepta hasta 100). */
  tamanoPagina?: number;
  /** Nombres de categoría de Dropi a importar. Sin lista, se recorre todo el catálogo. */
  categorias?: string[];
  /** Tope de productos NUEVOS aceptados por categoría (evita importar miles). */
  maxPorCategoria?: number;
  /** Solo para pruebas. */
  fetchImpl?: typeof fetch;
  /** Solo para pruebas: evita esperar entre reintentos. */
  esperaMs?: (intento: number) => number;
}

type Obj = Record<string, unknown>;

const esObjeto = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function entero(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function sinHtml(texto: string): string {
  return texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Convierte un producto de Dropi a nuestro formato. Lanza si no se puede vender. */
export function mapearProductoDropi(crudo: unknown): ProductoProveedor {
  if (!esObjeto(crudo)) throw new Error("el producto no es un objeto");
  const id = crudo.id;
  if ((typeof id !== "number" && typeof id !== "string") || String(id) === "") {
    throw new Error("el producto no trae id");
  }
  const nombre = typeof crudo.name === "string" ? crudo.name.trim() : "";
  if (!nombre) throw new Error("el producto no trae nombre");

  const costoProducto = entero(crudo.sale_price);

  const imagenes = (Array.isArray(crudo.gallery) ? crudo.gallery : [])
    .map((g) => (esObjeto(g) ? (g.urlS3 ?? g.url) : undefined))
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));

  const variaciones = Array.isArray(crudo.variations) ? crudo.variations : [];
  let variantes: VarianteProveedor[];

  if (variaciones.length > 0) {
    variantes = variaciones.filter(esObjeto).map((v) => {
      const atributos: Record<string, string> = {};
      for (const a of Array.isArray(v.attributes) ? v.attributes : []) {
        if (esObjeto(a) && typeof a.name === "string" && a.value != null) {
          atributos[a.name.trim()] = String(a.value).trim();
        }
      }
      const costo = Number.isNaN(entero(v.sale_price)) ? costoProducto : entero(v.sale_price);
      return {
        idExterno: String(v.id),
        sku: typeof v.sku === "string" ? v.sku : undefined,
        atributos,
        costo,
        stock: Math.max(0, Number.isNaN(entero(v.stock)) ? 0 : entero(v.stock)),
      };
    });
  } else {
    variantes = [
      {
        idExterno: String(id),
        sku: typeof crudo.sku === "string" ? crudo.sku : undefined,
        atributos: {},
        costo: costoProducto,
        stock: Math.max(0, Number.isNaN(entero(crudo.stock)) ? 0 : entero(crudo.stock)),
      },
    ];
  }

  // Un costo inválido o en cero haría un precio de venta sin sentido: no se importa.
  if (variantes.length === 0 || variantes.some((v) => !(v.costo > 0))) {
    throw new Error("el costo (sale_price) no es válido");
  }

  return {
    idExterno: String(id),
    nombre,
    descripcion: typeof crudo.description === "string" ? sinHtml(crudo.description) : "",
    imagenes,
    variantes,
  };
}

const REINTENTABLES = new Set([502, 503, 504]);

export class AdaptadorDropi implements AdaptadorProveedor {
  readonly id = "dropi";

  private readonly base: string;
  private readonly tamano: number;
  private readonly categorias: (string | undefined)[];
  private readonly maxPorCategoria: number;
  private readonly http: typeof fetch;
  private readonly espera: (intento: number) => number;

  // Estado de la lectura. El motor de sincronización pide las páginas en orden.
  private indiceConsulta = 0;
  private desplazamiento = 0;
  private aceptadosEnConsulta = 0;
  private readonly vistos = new Set<string>();

  constructor(private readonly opciones: OpcionesDropi) {
    if (!opciones.token) throw new Error("Falta el token de Dropi (DROPI_TOKEN).");
    this.base = (opciones.baseUrl ?? BASE_POR_DEFECTO).replace(/\/?$/, "/");
    this.tamano = Math.min(100, Math.max(1, opciones.tamanoPagina ?? 50));
    this.categorias = opciones.categorias?.length ? opciones.categorias : [undefined];
    this.maxPorCategoria = opciones.maxPorCategoria ?? 40;
    this.http = opciones.fetchImpl ?? fetch;
    this.espera = opciones.esperaMs ?? ((n) => 1000 * 2 ** n);
  }

  private async solicitar(ruta: string, cuerpo: unknown): Promise<Obj> {
    let ultimoError: unknown;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const res = await this.http(this.base + ruta, {
          method: "POST",
          headers: {
            "Content-Type": "application/json;charset=UTF-8",
            "dropi-integration-key": this.opciones.token,
          },
          body: JSON.stringify(cuerpo),
          signal: AbortSignal.timeout(30_000),
        });
        const texto = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(texto);
        } catch {
          json = undefined;
        }
        const j = esObjeto(json) ? json : {};

        if (REINTENTABLES.has(res.status) && intento < 2) {
          await new Promise((r) => setTimeout(r, this.espera(intento)));
          continue;
        }
        if (res.status === 401) {
          const ip = typeof j.ip === "string" ? ` (Dropi ve la IP ${j.ip})` : "";
          throw new Error(
            `Dropi respondió 401 Access denied${ip}. Casi siempre significa que la IP o el dominio de este servidor no están registrados en tu tienda de Dropi (Mis tiendas), o que el token no corresponde.`,
          );
        }
        if (!res.ok || j.isSuccess === false) {
          const detalle = typeof j.message === "string" && j.message ? j.message : texto.slice(0, 200);
          throw new Error(`Dropi respondió ${res.status}: ${detalle}`);
        }
        return j;
      } catch (e) {
        ultimoError = e;
        const transitorio = e instanceof TypeError || (e instanceof DOMException && e.name === "TimeoutError");
        if (transitorio && intento < 2) {
          await new Promise((r) => setTimeout(r, this.espera(intento)));
          continue;
        }
        throw e;
      }
    }
    throw ultimoError;
  }

  /**
   * Lee la siguiente página con productos nuevos. La paginación de Dropi NO es
   * confiable: una página puede traer menos elementos que `pageSize` y la siguiente
   * traer más. Por eso solo se pasa a la siguiente categoría cuando una página llega
   * completamente vacía.
   */
  async listarProductos(): Promise<{ productos: ProductoProveedor[]; hayMas: boolean }> {
    while (this.indiceConsulta < this.categorias.length) {
      const categoria = this.categorias[this.indiceConsulta];
      const respuesta = await this.solicitar("products/index", {
        startData: this.desplazamiento,
        pageSize: this.tamano,
        order_type: "desc",
        order_by: "id",
        keywords: "",
        active: true,
        no_count: true,
        integration: true,
        get_stock: true,
        ...(categoria ? { category: categoria } : {}),
      });
      const crudos = Array.isArray(respuesta.objects) ? respuesta.objects : [];

      if (crudos.length === 0) {
        this.indiceConsulta++;
        this.desplazamiento = 0;
        this.aceptadosEnConsulta = 0;
        continue;
      }
      this.desplazamiento += this.tamano;

      const productos: ProductoProveedor[] = [];
      for (const c of crudos) {
        if (this.aceptadosEnConsulta >= this.maxPorCategoria) break;
        const idCrudo = esObjeto(c) ? String(c.id) : "";
        if (idCrudo && this.vistos.has(idCrudo)) continue; // ya llegó por otra categoría
        try {
          productos.push(mapearProductoDropi(c));
        } catch (e) {
          // Se entrega marcado como rechazado: el motor lo cuenta como error con su
          // motivo, sin detener la sincronización.
          productos.push({
            idExterno: idCrudo || "desconocido",
            nombre: esObjeto(c) && typeof c.name === "string" ? c.name : "(sin nombre)",
            descripcion: "",
            imagenes: [],
            variantes: [],
            motivoRechazo: e instanceof Error ? e.message : String(e),
          });
        }
        if (idCrudo) this.vistos.add(idCrudo);
        this.aceptadosEnConsulta++;
      }

      if (this.aceptadosEnConsulta >= this.maxPorCategoria) {
        this.indiceConsulta++;
        this.desplazamiento = 0;
        this.aceptadosEnConsulta = 0;
      }
      return { productos, hayMas: this.indiceConsulta < this.categorias.length };
    }
    return { productos: [], hayMas: false };
  }

  async obtenerStock(): Promise<number> {
    throw new Error("Dropi: consultar el stock de una variante suelta aún no está implementado.");
  }

  async crearPedido(): Promise<never> {
    throw new Error(
      "Dropi: crear pedidos aún no está implementado. Hay que probarlo primero contra el ambiente de pruebas de Dropi.",
    );
  }
}
