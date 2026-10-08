import assert from "node:assert/strict";
import { test } from "node:test";
import { AdaptadorDropi, mapearProductoDropi } from "./dropi";

// Muestras reales devueltas por el conector MCP de Dropi (8-oct-2026).
const simple = {
  id: 778597, sku: "97077", name: "Cadena de tigre plata", sale_price: 6666,
  suggested_price: 40000, stock: 499, supplier_id: 5473,
  categories: ["Belleza", "Moda", "Bisutería"],
  gallery: [{ urlS3: "https://d39ru7awumhhs2.cloudfront.net/colombia/products/778597/foto.jpeg" }],
  variations: [],
};
const variable = {
  id: 1069166, sku: null, name: "Billetera Ref. 1", sale_price: 31000,
  suggested_price: 55.9, stock: 0, supplier_id: 148087,
  gallery: [{ urlS3: "https://d39ru7awumhhs2.cloudfront.net/colombia/products/1069166/b.jpeg" }],
  variations: [
    { id: 805601, sku: "-6", stock: 8, sale_price: 31000, suggested_price: 55900, attributes: [{ name: "COLOR", value: "AZUL ESTAMPADO" }] },
    { id: 805595, sku: null, stock: 0, sale_price: 31000, suggested_price: 55900, attributes: [{ name: "COLOR", value: "ROJO" }] },
  ],
};
const sinFotos = { id: 1888174, sku: "9Z7KEOVQCI", name: "panty-menstrual", sale_price: 1000, suggested_price: 38900, stock: 100, categories: [], gallery: [], variations: [] };
const costoCero = { id: 5, name: "Roto", sale_price: 0, stock: 3, gallery: [], variations: [] };

test("producto simple: una variante con el id del producto", () => {
  const p = mapearProductoDropi(simple);
  assert.equal(p.idExterno, "778597");
  assert.equal(p.variantes.length, 1);
  assert.deepEqual(p.variantes[0], { idExterno: "778597", sku: "97077", atributos: {}, costo: 6666, stock: 499 });
  assert.equal(p.imagenes.length, 1);
});

test("producto variable: una variante por variación, con sus atributos y stock propio", () => {
  const p = mapearProductoDropi(variable);
  assert.equal(p.variantes.length, 2);
  assert.deepEqual(p.variantes[0].atributos, { COLOR: "AZUL ESTAMPADO" });
  assert.equal(p.variantes[0].idExterno, "805601");
  assert.equal(p.variantes[0].stock, 8, "el stock sale de la variación, no del 0 del producto");
});

test("sin fotos se importa igual (queda para revisión); costo cero se rechaza", () => {
  assert.deepEqual(mapearProductoDropi(sinFotos).imagenes, []);
  assert.throws(() => mapearProductoDropi(costoCero), /costo/);
  assert.throws(() => mapearProductoDropi({ name: "x", sale_price: 5 }), /id/);
  assert.throws(() => mapearProductoDropi(null), /objeto/);
});

// ----------------------------------------------------------- adaptador
interface Llamada { url: string; headers: Record<string, string>; cuerpo: Record<string, unknown> }

function falsoFetch(respuestas: { status?: number; json: unknown }[]) {
  const llamadas: Llamada[] = [];
  let i = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      cuerpo: JSON.parse(String(init?.body)),
    });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { impl, llamadas };
}
const ok = (objects: unknown[]) => ({ json: { isSuccess: true, objects } });
const nuevo = (extra: Partial<typeof simple> = {}) => ({ ...simple, ...extra });

test("envía el token en el encabezado correcto y los parámetros esperados", async () => {
  const { impl, llamadas } = falsoFetch([ok([simple])]);
  const a = new AdaptadorDropi({ token: "TOKEN-X", fetchImpl: impl, categorias: ["Hogar"] });
  await a.listarProductos();
  assert.equal(llamadas[0].url, "https://api.dropi.co/integrations/products/index");
  assert.equal(llamadas[0].headers["dropi-integration-key"], "TOKEN-X");
  assert.equal(llamadas[0].cuerpo.category, "Hogar");
  assert.equal(llamadas[0].cuerpo.startData, 0);
  assert.equal(llamadas[0].cuerpo.active, true);
  assert.equal(llamadas[0].cuerpo.integration, true);
});

test("una página incompleta NO termina la lectura; solo una página vacía avanza", async () => {
  const { impl, llamadas } = falsoFetch([
    ok([nuevo({ id: 1 }), nuevo({ id: 2 })]), // pidió 50, llegaron 2
    ok([nuevo({ id: 3 })]), // la siguiente trae más
    ok([]), // vacía: termina la categoría
    ok([nuevo({ id: 10 })]), // segunda categoría
    ok([]),
  ]);
  const a = new AdaptadorDropi({ token: "t", fetchImpl: impl, categorias: ["Hogar", "Mascotas"] });
  const ids: string[] = [];
  for (let n = 0; n < 10; n++) {
    const { productos, hayMas } = await a.listarProductos();
    ids.push(...productos.map((p) => p.idExterno));
    if (!hayMas) break;
  }
  assert.deepEqual(ids, ["1", "2", "3", "10"]);
  assert.equal(llamadas[1].cuerpo.startData, 50, "la segunda página avanza el desplazamiento");
  assert.equal(llamadas[3].cuerpo.category, "Mascotas");
  assert.equal(llamadas[3].cuerpo.startData, 0, "al cambiar de categoría se reinicia");
});

test("un producto que llega por dos categorías se entrega una sola vez", async () => {
  const { impl } = falsoFetch([ok([nuevo({ id: 7 })]), ok([]), ok([nuevo({ id: 7 }), nuevo({ id: 8 })]), ok([])]);
  const a = new AdaptadorDropi({ token: "t", fetchImpl: impl, categorias: ["Hogar", "Cocina"] });
  const ids: string[] = [];
  for (let n = 0; n < 10; n++) {
    const r = await a.listarProductos();
    ids.push(...r.productos.map((p) => p.idExterno));
    if (!r.hayMas) break;
  }
  assert.deepEqual(ids, ["7", "8"]);
});

test("respeta el tope de productos por categoría", async () => {
  const lote = [1, 2, 3, 4, 5].map((id) => nuevo({ id }));
  const { impl, llamadas } = falsoFetch([ok(lote), ok([nuevo({ id: 99 })]), ok([])]);
  const a = new AdaptadorDropi({ token: "t", fetchImpl: impl, categorias: ["Hogar", "Mascotas"], maxPorCategoria: 3 });
  const r1 = await a.listarProductos();
  assert.equal(r1.productos.length, 3);
  assert.equal(r1.hayMas, true);
  await a.listarProductos();
  assert.equal(llamadas[1].cuerpo.category, "Mascotas", "tras el tope pasa a la siguiente categoría");
});

test("los productos que no se pueden interpretar llegan marcados con su motivo", async () => {
  const { impl } = falsoFetch([ok([simple, costoCero]), ok([])]);
  const a = new AdaptadorDropi({ token: "t", fetchImpl: impl });
  const { productos } = await a.listarProductos();
  assert.equal(productos.length, 2);
  assert.equal(productos[0].motivoRechazo, undefined);
  assert.match(productos[1].motivoRechazo ?? "", /costo/);
  assert.equal(productos[1].variantes.length, 0);
});

test("reintenta ante 504 y luego funciona", async () => {
  const { impl, llamadas } = falsoFetch([{ status: 504, json: { message: "Endpoint request timed out" } }, ok([simple])]);
  const a = new AdaptadorDropi({ token: "t", fetchImpl: impl, esperaMs: () => 0 });
  const { productos } = await a.listarProductos();
  assert.equal(productos.length, 1);
  assert.equal(llamadas.length, 2);
});

test("401 explica que probablemente falta registrar la IP o el dominio", async () => {
  const { impl } = falsoFetch([{ status: 401, json: { isSuccess: false, message: "Access denied", status: 401, ip: "38.225.57.111" } }]);
  const a = new AdaptadorDropi({ token: "t", fetchImpl: impl });
  await assert.rejects(() => a.listarProductos(), (e: Error) =>
    /401/.test(e.message) && /38\.225\.57\.111/.test(e.message) && /IP o el dominio/.test(e.message));
});

test("crear pedido y consultar stock suelto están deshabilitados a propósito", async () => {
  const a = new AdaptadorDropi({ token: "t", fetchImpl: falsoFetch([ok([])]).impl });
  await assert.rejects(() => a.crearPedido(), /no está implementado/);
  await assert.rejects(() => a.obtenerStock(), /no está implementado/);
  assert.throws(() => new AdaptadorDropi({ token: "" }), /DROPI_TOKEN/);
});
