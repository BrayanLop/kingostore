import assert from "node:assert/strict";
import { test } from "node:test";
import { margenReal, type ReglaPrecio } from "@/modules/precios";
import type {
  AdaptadorProveedor,
  ProductoProveedor,
} from "@/modules/proveedores/types";
import { crearSlug } from "./slug";
import {
  sincronizarProveedor,
  type DatosProductoNuevo,
  type DatosVariante,
  type ProductoExistente,
  type RepositorioSync,
  type ResumenSync,
} from "./sincronizar";

// Repositorio en memoria: sirve para probar el motor sin base de datos.
function repoEnMemoria(reglas: ReglaPrecio[] = []) {
  const productos = new Map<
    string,
    DatosProductoNuevo & {
      id: string;
      estado: string;
      variantes: Map<string, DatosVariante & { id: string }>;
    }
  >();
  const registros: ResumenSync[] = [];
  let n = 0;
  const llave = (prov: string, ext: string) => `${prov}|${ext}`;

  const repo: RepositorioSync = {
    async iniciar() {
      return "reg-1";
    },
    async reglasDePrecio() {
      return reglas;
    },
    async buscarProducto(prov, ext): Promise<ProductoExistente | null> {
      const p = productos.get(llave(prov, ext));
      if (!p) return null;
      return {
        id: p.id,
        categoriaId: null,
        variantes: [...p.variantes.values()].map((v) => ({
          id: v.id,
          idExterno: v.idExterno,
        })),
      };
    },
    async crearProducto(d) {
      const id = `p${++n}`;
      productos.set(llave(d.proveedorId, d.idExterno), {
        ...d, id, estado: "borrador", variantes: new Map(),
      });
      return id;
    },
    async guardarVariante(productoId, v) {
      const p = [...productos.values()].find((x) => x.id === productoId)!;
      const previa = p.variantes.get(v.idExterno);
      p.variantes.set(v.idExterno, { ...v, id: previa?.id ?? `v${++n}` });
    },
    async ponerSinStock(ids) {
      for (const p of productos.values()) {
        for (const v of p.variantes.values()) if (ids.includes(v.id)) v.stock = 0;
      }
    },
    async finalizar(_id, resumen) {
      registros.push(resumen);
    },
  };
  return { repo, productos, registros };
}

function adaptador(...paginas: ProductoProveedor[][]): AdaptadorProveedor {
  return {
    id: "prueba",
    async listarProductos(pagina) {
      return { productos: paginas[pagina - 1] ?? [], hayMas: pagina < paginas.length };
    },
    async obtenerStock() { return 0; },
    async crearPedido() { throw new Error("no usado"); },
  };
}

const camiseta: ProductoProveedor = {
  idExterno: "A1", nombre: "Camiseta Básica", descripcion: "Algodón", imagenes: [],
  variantes: [
    { idExterno: "A1-S", atributos: { Talla: "S" }, costo: 20000, stock: 5 },
    { idExterno: "A1-M", atributos: { Talla: "M" }, costo: 20000, stock: 8 },
  ],
};
const taza: ProductoProveedor = {
  idExterno: "B2", nombre: "Taza", descripcion: "", imagenes: [],
  variantes: [{ idExterno: "B2", atributos: {}, costo: 8000, stock: 10 }],
};

test("crea productos nuevos en BORRADOR con precio calculado por la regla", async () => {
  const { repo, productos } = repoEnMemoria([
    { alcance: "global", margenMin: 40, redondeo: 500 },
  ]);
  const r = await sincronizarProveedor(adaptador([camiseta, taza]), "prov", repo);

  assert.equal(r.productosCreados, 2);
  assert.equal(r.variantesCreadas, 3);
  assert.equal(r.errores, 0);
  const p = productos.get("prov|A1")!;
  assert.equal(p.estado, "borrador");
  const v = p.variantes.get("A1-S")!;
  assert.equal(v.precioVenta % 500, 0);
  assert.ok(margenReal(v.precioVenta, 20000) >= 40);
});

test("repetir la sincronización no duplica y actualiza costo, precio y stock", async () => {
  const { repo, productos } = repoEnMemoria();
  await sincronizarProveedor(adaptador([camiseta]), "prov", repo);
  const nuevo: ProductoProveedor = {
    ...camiseta,
    nombre: "Nombre que cambió en el proveedor",
    variantes: [
      { idExterno: "A1-S", atributos: { Talla: "S" }, costo: 25000, stock: 2 },
      { idExterno: "A1-M", atributos: { Talla: "M" }, costo: 20000, stock: 8 },
    ],
  };
  const r = await sincronizarProveedor(adaptador([nuevo]), "prov", repo);

  assert.equal(r.productosCreados, 0);
  assert.equal(r.productosActualizados, 1);
  assert.equal(r.variantesActualizadas, 2);
  assert.equal(productos.size, 1);
  const p = productos.get("prov|A1")!;
  assert.equal(p.nombre, "Camiseta Básica", "el nombre no se pisa");
  assert.equal(p.variantes.get("A1-S")!.costo, 25000);
  assert.equal(p.variantes.get("A1-S")!.stock, 2);
  assert.ok(p.variantes.get("A1-S")!.precioVenta > 25000);
});

test("la variante que el proveedor deja de enviar queda sin stock, no se borra", async () => {
  const { repo, productos } = repoEnMemoria();
  await sincronizarProveedor(adaptador([camiseta]), "prov", repo);
  const sinM: ProductoProveedor = { ...camiseta, variantes: [camiseta.variantes[0]] };
  const r = await sincronizarProveedor(adaptador([sinM]), "prov", repo);

  assert.equal(r.variantesSinStock, 1);
  const p = productos.get("prov|A1")!;
  assert.equal(p.variantes.size, 2);
  assert.equal(p.variantes.get("A1-M")!.stock, 0);
});

test("un producto con error no detiene a los demás", async () => {
  const { repo, productos, registros } = repoEnMemoria();
  const malo: ProductoProveedor = { ...taza, idExterno: "MALO", variantes: [] };
  const r = await sincronizarProveedor(adaptador([malo, camiseta]), "prov", repo);

  assert.equal(r.errores, 1);
  assert.equal(r.detalleErrores[0].idExterno, "MALO");
  assert.equal(r.productosCreados, 1);
  assert.ok(productos.has("prov|A1"));
  assert.equal(registros.length, 1, "queda registrada la corrida");
});

test("recorre todas las páginas del proveedor", async () => {
  const { repo, productos } = repoEnMemoria();
  await sincronizarProveedor(adaptador([camiseta], [taza]), "prov", repo);
  assert.equal(productos.size, 2);
});

test("si el proveedor falla del todo, se registra y se relanza el error", async () => {
  const { repo, registros } = repoEnMemoria();
  const roto: AdaptadorProveedor = {
    id: "roto",
    async listarProductos() { throw new Error("401 token vencido"); },
    async obtenerStock() { return 0; },
    async crearPedido() { throw new Error("no usado"); },
  };
  await assert.rejects(() => sincronizarProveedor(roto, "prov", repo), /401/);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].errores, 1);
});

test("el slug es estable, sin acentos y distinto por id del proveedor", () => {
  assert.equal(crearSlug("Camiseta Básica", "A1"), crearSlug("Camiseta Básica", "A1"));
  assert.notEqual(crearSlug("Camiseta Básica", "A1"), crearSlug("Camiseta Básica", "A2"));
  assert.match(crearSlug("Camiseta Básica ñandú!", "A1"), /^camiseta-basica-nandu-[a-z0-9]{6}$/);
  assert.match(crearSlug("¡¡¡", "X"), /^producto-[a-z0-9]{6}$/);
});
