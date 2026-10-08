import type {
  AdaptadorProveedor,
  ProductoProveedor,
  VarianteProveedor,
} from "./types";

// Adaptador de Venndelo (API pública "eCommerce API", versión Beta).
// Documentación oficial: https://api.venndelo.com/v1/admin-docs/
//
// Qué está verificado (8-oct-2026, con una cuenta real y solo lecturas):
//  · Intercambio de refresh token → access token (1 hora) y GET check-auth.
//  · GET /v1/admin/products?supply_model=DROPSHIP lista SOLO los productos que el
//    vendedor ya agregó a su tienda en Venndelo; no el catálogo de proveedores, y
//    sin imágenes (confirmado por su soporte).
//  · Los productos traen stock (quantity), supplier_price (nuestro costo) y
//    suggested_retail_price. Peso y dimensiones pueden venir en 0.
//
// Lo que NO está implementado a propósito: crear pedidos. Venndelo no tiene ambiente
// de pruebas, así que cualquier pedido sería real.
//
// El refresh token ROTA: cuando la respuesta trae uno nuevo, se persiste con
// `almacenToken.guardar` ANTES de usar el access token. Si no se guarda, se pierde el
// acceso.

const BASE_POR_DEFECTO = "https://api.venndelo.com";

export interface AlmacenToken {
  leer(): Promise<string>;
  guardar(nuevo: string): Promise<void>;
}

export interface OpcionesVenndelo {
  almacenToken: AlmacenToken;
  baseUrl?: string;
  /** Hasta 500 según la documentación. */
  tamanoPagina?: number;
  /** Solo para pruebas. */
  fetchImpl?: typeof fetch;
  ahora?: () => number;
  esperaMs?: (intento: number) => number;
}

type Obj = Record<string, unknown>;
const esObjeto = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function entero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/** Convierte un producto de Venndelo a nuestro formato. */
export function mapearProductoVenndelo(crudo: unknown): ProductoProveedor {
  if (!esObjeto(crudo)) throw new Error("el producto no es un objeto");
  const id = crudo.id;
  if ((typeof id !== "string" && typeof id !== "number") || String(id) === "") {
    throw new Error("el producto no trae id");
  }
  const nombre = typeof crudo.name === "string" ? crudo.name.trim() : "";
  if (!nombre) throw new Error("el producto no trae nombre");

  // Nombres de los atributos: options[i].label corresponde a option.attribute{i+1}.
  const etiquetas = (Array.isArray(crudo.options) ? crudo.options : []).map((o, i) =>
    esObjeto(o) && typeof o.label === "string" && o.label.trim() ? o.label.trim() : `Opción ${i + 1}`,
  );

  const variaciones = Array.isArray(crudo.variations) ? crudo.variations : [];
  const variantes: VarianteProveedor[] = variaciones.filter(esObjeto).map((v) => {
    const atributos: Record<string, string> = {};
    if (esObjeto(v.option)) {
      for (const [clave, valor] of Object.entries(v.option)) {
        const m = clave.match(/^attribute(\d+)$/);
        if (m && typeof valor === "string" && valor.trim()) {
          atributos[etiquetas[Number(m[1]) - 1] ?? `Opción ${m[1]}`] = valor.trim();
        }
      }
    }
    const sugerido = entero(v.suggested_retail_price);
    return {
      idExterno: String(v.id),
      sku: typeof v.sku === "string" && v.sku ? v.sku : undefined,
      atributos,
      costo: entero(v.supplier_price),
      precioSugerido: sugerido > 0 ? sugerido : undefined,
      stock: Math.max(0, Number.isNaN(entero(v.quantity)) ? 0 : entero(v.quantity)),
    };
  });

  if (variantes.length === 0) throw new Error("el producto no trae variaciones");
  if (variantes.some((v) => !(v.costo > 0))) {
    throw new Error("el precio de proveedor (supplier_price) no es válido");
  }

  return {
    idExterno: String(id),
    nombre,
    descripcion: typeof crudo.description === "string" ? crudo.description.replace(/\s+/g, " ").trim() : "",
    imagenes: [], // la API de Venndelo no entrega imágenes
    variantes,
  };
}

const REINTENTABLES = new Set([429, 502, 503, 504]);

export class AdaptadorVenndelo implements AdaptadorProveedor {
  readonly id = "venndelo";

  private readonly base: string;
  private readonly tamano: number;
  private readonly http: typeof fetch;
  private readonly ahora: () => number;
  private readonly espera: (intento: number) => number;

  private accessToken?: string;
  private accessVenceEn = 0;
  private cursor = "";
  private terminado = false;

  constructor(private readonly opciones: OpcionesVenndelo) {
    this.base = (opciones.baseUrl ?? BASE_POR_DEFECTO).replace(/\/+$/, "");
    this.tamano = Math.min(500, Math.max(1, opciones.tamanoPagina ?? 100));
    this.http = opciones.fetchImpl ?? fetch;
    this.ahora = opciones.ahora ?? Date.now;
    this.espera = opciones.esperaMs ?? ((n) => 1000 * 2 ** n);
  }

  private async obtenerAccessToken(): Promise<string> {
    if (this.accessToken && this.ahora() < this.accessVenceEn - 60_000) return this.accessToken;

    const refresh = (await this.opciones.almacenToken.leer()).trim();
    if (!refresh) throw new Error("Falta el refresh token de Venndelo (VENNDELO_REFRESH_TOKEN).");

    const res = await this.http(`${this.base}/v1/admin/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
      signal: AbortSignal.timeout(30_000),
    });
    const texto = await res.text();
    let json: Obj = {};
    try {
      const p = JSON.parse(texto);
      if (esObjeto(p)) json = p;
    } catch {
      /* respuesta no JSON */
    }

    // Si hay un refresh nuevo, se guarda PRIMERO, incluso si el resto falló.
    if (typeof json.refresh_token === "string" && json.refresh_token && json.refresh_token !== refresh) {
      await this.opciones.almacenToken.guardar(json.refresh_token);
    }
    if (!res.ok || typeof json.access_token !== "string") {
      throw new Error(`Venndelo no entregó el token de acceso (HTTP ${res.status}): ${JSON.stringify(json.errors ?? "").slice(0, 200)}`);
    }
    this.accessToken = json.access_token;
    this.accessVenceEn =
      typeof json.expires_at === "string" && !Number.isNaN(Date.parse(json.expires_at))
        ? Date.parse(json.expires_at)
        : this.ahora() + (Number(json.expires_in) || 3600) * 1000;
    return this.accessToken;
  }

  private async get(ruta: string): Promise<Obj> {
    for (let intento = 0; ; intento++) {
      const token = await this.obtenerAccessToken();
      const res = await this.http(this.base + ruta, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 401 && intento === 0) {
        this.accessToken = undefined; // pudo vencer: se pide uno nuevo una vez
        continue;
      }
      if (REINTENTABLES.has(res.status) && intento < 2) {
        await new Promise((r) => setTimeout(r, this.espera(intento)));
        continue;
      }
      const texto = await res.text();
      let json: Obj = {};
      try {
        const p = JSON.parse(texto);
        if (esObjeto(p)) json = p;
      } catch {
        /* respuesta no JSON */
      }
      if (!res.ok) {
        throw new Error(`Venndelo respondió ${res.status}: ${JSON.stringify(json.errors ?? texto.slice(0, 200)).slice(0, 300)}`);
      }
      return json;
    }
  }

  /** Lee la siguiente página de productos DROPSHIP de la tienda del vendedor. */
  async listarProductos(): Promise<{ productos: ProductoProveedor[]; hayMas: boolean }> {
    if (this.terminado) return { productos: [], hayMas: false };
    const consulta = new URLSearchParams({ page_size: String(this.tamano), supply_model: "DROPSHIP" });
    if (this.cursor) consulta.set("page_token", this.cursor);
    const r = await this.get(`/v1/admin/products?${consulta}`);

    const items = Array.isArray(r.items) ? r.items : [];
    const siguiente = typeof r.next_page_token === "string" ? r.next_page_token : "";
    this.cursor = siguiente;
    this.terminado = siguiente === ""; // token vacío = última página (documentado)

    const productos = items.map((c): ProductoProveedor => {
      try {
        return mapearProductoVenndelo(c);
      } catch (e) {
        return {
          idExterno: esObjeto(c) ? String(c.id ?? "desconocido") : "desconocido",
          nombre: esObjeto(c) && typeof c.name === "string" ? c.name : "(sin nombre)",
          descripcion: "",
          imagenes: [],
          variantes: [],
          motivoRechazo: e instanceof Error ? e.message : String(e),
        };
      }
    });
    return { productos, hayMas: !this.terminado };
  }

  async obtenerStock(): Promise<number> {
    throw new Error("Venndelo: consultar el stock de una variante suelta aún no está implementado.");
  }

  async crearPedido(): Promise<never> {
    throw new Error(
      "Venndelo: crear pedidos aún no está implementado. No hay ambiente de pruebas: cualquier pedido sería real.",
    );
  }
}
