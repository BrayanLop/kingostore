import assert from "node:assert/strict";
import { test } from "node:test";
import { AdaptadorVenndelo, mapearProductoVenndelo, type AlmacenToken } from "./venndelo";

// Muestra real devuelta por la API de Venndelo (8-oct-2026), con la cuenta de prueba.
const diadema = {
  id: "1061703",
  name: "DIADEMA BLUETHOO IMITACION JBL",
  description: "DIADEMA BLUETHOOT\nMODO DE MANOS LIBRES VARIEDAD DE COLORES \nINALAMBRICA",
  processing_time: "1",
  options: [],
  variations: [
    {
      id: "1328193", sku: "", quantity: 145, width: 0, height: 0, length: 0, weight: 0,
      option: { attribute1: "", attribute2: "" },
      price: 69999, compare_at_price: 69999, supplier_price: 48000, suggested_retail_price: 70000,
    },
  ],
};

const conTallas = {
  id: "77", name: "Camiseta", description: "", processing_time: "2",
  options: [{ code: "color", label: "Color" }, { code: "talla", label: "Talla" }],
  variations: [
    { id: "1", sku: "C-R-M", quantity: 4, option: { attribute1: "Rojo", attribute2: "M" }, supplier_price: 20000, suggested_retail_price: 35000 },
    { id: "2", sku: "C-A-L", quantity: 0, option: { attribute1: "Azul", attribute2: "L" }, supplier_price: 20000, suggested_retail_price: 0 },
  ],
};

test("mapea el producto real: costo, stock, sugerido y sin imágenes", () => {
  const p = mapearProductoVenndelo(diadema);
  assert.equal(p.idExterno, "1061703");
  assert.deepEqual(p.imagenes, [], "la API no entrega imágenes");
  assert.equal(p.descripcion, "DIADEMA BLUETHOOT MODO DE MANOS LIBRES VARIEDAD DE COLORES INALAMBRICA");
  assert.deepEqual(p.variantes[0], {
    idExterno: "1328193", sku: undefined, atributos: {}, costo: 48000, precioSugerido: 70000, stock: 145,
  });
});

test("los atributos toman su nombre de options[] y se ignoran los vacíos", () => {
  const p = mapearProductoVenndelo(conTallas);
  assert.deepEqual(p.variantes[0].atributos, { Color: "Rojo", Talla: "M" });
  assert.equal(p.variantes[1].stock, 0);
  assert.equal(p.variantes[1].precioSugerido, undefined, "sugerido 0 se descarta");
});

test("rechaza productos sin variaciones o con precio de proveedor inválido", () => {
  assert.throws(() => mapearProductoVenndelo({ ...diadema, variations: [] }), /variaciones/);
  assert.throws(
    () => mapearProductoVenndelo({ ...diadema, variations: [{ ...diadema.variations[0], supplier_price: 0 }] }),
    /supplier_price/,
  );
  assert.throws(() => mapearProductoVenndelo({ name: "x", variations: [] }), /id/);
});

// ------------------------------------------------------------ adaptador
function almacen(inicial = "REFRESH-1") {
  const guardados: string[] = [];
  let actual = inicial;
  const a: AlmacenToken = {
    async leer() { return actual; },
    async guardar(n) { guardados.push(n); actual = n; },
  };
  return { a, guardados, actual: () => actual };
}

interface Llamada { url: string; metodo: string; headers: Record<string, string>; cuerpo?: string }
function falsoFetch(respuestas: { status?: number; json: unknown }[]) {
  const llamadas: Llamada[] = [];
  let i = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({
      url: String(url), metodo: String(init?.method), headers: init?.headers as Record<string, string>,
      cuerpo: init?.body ? String(init.body) : undefined,
    });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { impl, llamadas };
}
const token = (extra: Record<string, unknown> = {}) => ({
  json: { access_token: "ACCESS-1", token_type: "Bearer", expires_in: 3600, expires_at: "2099-01-01T00:00:00Z", ...extra },
});
const pagina = (items: unknown[], siguiente = "") => ({ json: { curr_page_token: "x", next_page_token: siguiente, page_item_count: items.length, items } });
const base = { esperaMs: () => 0 };

test("intercambia el refresh token y pide productos DROPSHIP con Bearer", async () => {
  const { impl, llamadas } = falsoFetch([token(), pagina([diadema])]);
  const { a } = almacen();
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: a, fetchImpl: impl });
  const r = await ad.listarProductos();

  assert.equal(r.productos.length, 1);
  assert.equal(r.hayMas, false, "next_page_token vacío = última página");
  assert.equal(llamadas[0].metodo, "POST");
  assert.match(llamadas[0].url, /\/v1\/admin\/oauth\/token$/);
  assert.match(llamadas[0].cuerpo ?? "", /grant_type=refresh_token/);
  assert.match(llamadas[0].cuerpo ?? "", /refresh_token=REFRESH-1/);
  assert.match(llamadas[1].url, /supply_model=DROPSHIP/);
  assert.equal(llamadas[1].headers.Authorization, "Bearer ACCESS-1");
});

test("si el refresh token rota, se guarda el nuevo ANTES de consultar productos", async () => {
  const orden: string[] = [];
  const { a, guardados } = almacen();
  const original = a.guardar;
  a.guardar = async (n) => { orden.push("guardar"); await original(n); };
  const { impl, llamadas } = falsoFetch([token({ refresh_token: "REFRESH-2" }), pagina([])]);
  const envuelto = (async (u: string | URL | Request, i?: RequestInit) => {
    if (String(u).includes("/products")) orden.push("productos");
    return impl(u, i);
  }) as typeof fetch;
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: a, fetchImpl: envuelto });
  await ad.listarProductos();

  assert.deepEqual(guardados, ["REFRESH-2"]);
  assert.deepEqual(orden, ["guardar", "productos"]);
  assert.equal(llamadas.length, 2);
});

test("si el intercambio falla pero trae un refresh nuevo, igual se guarda", async () => {
  const { impl } = falsoFetch([{ status: 400, json: { refresh_token: "REFRESH-X", errors: [{ message: "x" }] } }]);
  const { a, guardados } = almacen();
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: a, fetchImpl: impl });
  await assert.rejects(() => ad.listarProductos(), /token de acceso/);
  assert.deepEqual(guardados, ["REFRESH-X"]);
});

test("el mensaje de error nunca incluye los tokens", async () => {
  const { impl } = falsoFetch([{ status: 401, json: { errors: [{ message: "Credentials are expired or invalid." }] } }]);
  const { a } = almacen("SECRETO-123");
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: a, fetchImpl: impl });
  await assert.rejects(() => ad.listarProductos(), (e: Error) => !/SECRETO-123/.test(e.message) && /expired or invalid/.test(e.message));
});

test("pagina con page_token hasta que el siguiente token venga vacío", async () => {
  const { impl, llamadas } = falsoFetch([
    token(), pagina([diadema], "PAG-2"), pagina([{ ...diadema, id: "2" }], ""),
  ]);
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: almacen().a, fetchImpl: impl });
  const p1 = await ad.listarProductos();
  const p2 = await ad.listarProductos();
  const p3 = await ad.listarProductos();

  assert.equal(p1.hayMas, true);
  assert.match(llamadas[2].url, /page_token=PAG-2/);
  assert.equal(p2.hayMas, false);
  assert.deepEqual(p3, { productos: [], hayMas: false });
  assert.equal(llamadas.filter((l) => l.url.includes("oauth")).length, 1, "reutiliza el access token vigente");
});

test("reintenta ante 429/504 y renueva el acceso una vez si da 401", async () => {
  const { impl, llamadas } = falsoFetch([
    token(), { status: 429, json: {} }, pagina([diadema]),
  ]);
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: almacen().a, fetchImpl: impl });
  assert.equal((await ad.listarProductos()).productos.length, 1);
  assert.equal(llamadas.length, 3);

  const r401 = falsoFetch([token(), { status: 401, json: {} }, token({ access_token: "ACCESS-2" }), pagina([diadema])]);
  const ad2 = new AdaptadorVenndelo({ ...base, almacenToken: almacen().a, fetchImpl: r401.impl });
  assert.equal((await ad2.listarProductos()).productos.length, 1);
  assert.equal(r401.llamadas[3].headers.Authorization, "Bearer ACCESS-2");
});

test("un producto inválido llega marcado con su motivo; crear pedido está deshabilitado", async () => {
  const { impl } = falsoFetch([token(), pagina([diadema, { id: "9", name: "Roto", variations: [] }])]);
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: almacen().a, fetchImpl: impl });
  const { productos } = await ad.listarProductos();
  assert.equal(productos[0].motivoRechazo, undefined);
  assert.match(productos[1].motivoRechazo ?? "", /variaciones/);
  await assert.rejects(() => ad.crearPedido(), /ambiente de pruebas/);
  await assert.rejects(() => ad.obtenerStock(), /no está implementado/);
});

test("sin refresh token avisa con claridad", async () => {
  const ad = new AdaptadorVenndelo({ ...base, almacenToken: almacen("").a, fetchImpl: falsoFetch([token()]).impl });
  await assert.rejects(() => ad.listarProductos(), /VENNDELO_REFRESH_TOKEN/);
});
