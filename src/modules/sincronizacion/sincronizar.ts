import {
  calcularPrecioVenta,
  resolverRegla,
  type ReglaPrecio,
} from "@/modules/precios";
import type {
  AdaptadorProveedor,
  ProductoProveedor,
} from "@/modules/proveedores/types";
import { crearSlug } from "./slug";

// Motor de sincronización: trae productos de un proveedor y los deja en nuestra
// base. Reglas:
//  · Producto nuevo → se crea en BORRADOR (no se publica solo: alguien lo revisa).
//  · Producto existente → solo se actualizan costo, precio de venta y stock de sus
//    variantes. Nombre, descripción y estado NO se tocan (pueden estar editados).
//  · Variante que el proveedor ya no envía → stock en 0 (no se borra: hay pedidos
//    históricos que la referencian).
//  · Un producto que falla no detiene a los demás; los errores se cuentan y se listan.

export interface ProductoExistente {
  id: string;
  categoriaId: string | null;
  variantes: { id: string; idExterno: string | null }[];
}

export interface DatosProductoNuevo {
  proveedorId: string;
  idExterno: string;
  slug: string;
  nombre: string;
  descripcion: string;
  imagenes: string[];
}

export interface DatosVariante {
  idExterno: string;
  sku?: string;
  atributos: Record<string, string>;
  costo: number;
  precioVenta: number;
  stock: number;
}

/** Acceso a datos que necesita el motor. En producción lo implementa Supabase. */
export interface RepositorioSync {
  iniciar(proveedorId: string): Promise<string>;
  reglasDePrecio(): Promise<ReglaPrecio[]>;
  buscarProducto(
    proveedorId: string,
    idExterno: string,
  ): Promise<ProductoExistente | null>;
  crearProducto(datos: DatosProductoNuevo): Promise<string>;
  guardarVariante(productoId: string, variante: DatosVariante): Promise<void>;
  ponerSinStock(varianteIds: string[]): Promise<void>;
  finalizar(registroId: string, resumen: ResumenSync): Promise<void>;
}

export interface ResumenSync {
  productosCreados: number;
  productosActualizados: number;
  variantesCreadas: number;
  variantesActualizadas: number;
  variantesSinStock: number;
  errores: number;
  detalleErrores: { idExterno: string; mensaje: string }[];
}

const MAX_PAGINAS = 500; // tope de seguridad contra un proveedor que nunca termina

function resumenVacio(): ResumenSync {
  return {
    productosCreados: 0,
    productosActualizados: 0,
    variantesCreadas: 0,
    variantesActualizadas: 0,
    variantesSinStock: 0,
    errores: 0,
    detalleErrores: [],
  };
}

async function sincronizarProducto(
  repo: RepositorioSync,
  proveedorId: string,
  reglas: ReglaPrecio[],
  producto: ProductoProveedor,
  resumen: ResumenSync,
): Promise<void> {
  if (producto.variantes.length === 0) {
    throw new Error("el producto no trae variantes");
  }

  let existente = await repo.buscarProducto(proveedorId, producto.idExterno);
  const esNuevo = existente === null;
  let productoId: string;
  if (existente) {
    productoId = existente.id;
  } else {
    productoId = await repo.crearProducto({
      proveedorId,
      idExterno: producto.idExterno,
      slug: crearSlug(producto.nombre, producto.idExterno),
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      imagenes: producto.imagenes,
    });
    existente = { id: productoId, categoriaId: null, variantes: [] };
  }

  const regla = resolverRegla(reglas, {
    productoId,
    categoriaId: existente.categoriaId,
  });
  const idsVistos = new Set<string>();

  for (const v of producto.variantes) {
    idsVistos.add(v.idExterno);
    const yaExistia = existente.variantes.some((e) => e.idExterno === v.idExterno);
    await repo.guardarVariante(productoId, {
      idExterno: v.idExterno,
      sku: v.sku,
      atributos: v.atributos,
      costo: v.costo,
      precioVenta: calcularPrecioVenta({
        costo: v.costo,
        margenMin: regla.margenMin,
        redondeo: regla.redondeo,
      }),
      stock: Math.max(0, v.stock),
    });
    if (yaExistia) resumen.variantesActualizadas++;
    else resumen.variantesCreadas++;
  }

  const desaparecidas = existente.variantes
    .filter((e) => e.idExterno !== null && !idsVistos.has(e.idExterno))
    .map((e) => e.id);
  if (desaparecidas.length > 0) {
    await repo.ponerSinStock(desaparecidas);
    resumen.variantesSinStock += desaparecidas.length;
  }

  // Se cuenta al final, cuando el producto se sincronizó completo.
  if (esNuevo) resumen.productosCreados++;
  else resumen.productosActualizados++;
}

export async function sincronizarProveedor(
  adaptador: AdaptadorProveedor,
  proveedorId: string,
  repo: RepositorioSync,
): Promise<ResumenSync> {
  const registroId = await repo.iniciar(proveedorId);
  const resumen = resumenVacio();

  try {
    const reglas = await repo.reglasDePrecio();
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const { productos, hayMas } = await adaptador.listarProductos(pagina);
      for (const producto of productos) {
        try {
          await sincronizarProducto(repo, proveedorId, reglas, producto, resumen);
        } catch (e) {
          resumen.errores++;
          resumen.detalleErrores.push({
            idExterno: producto.idExterno,
            mensaje: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (!hayMas) break;
    }
  } catch (e) {
    // Fallo del proveedor entero (red, credenciales, etc.): se registra y se relanza.
    resumen.errores++;
    resumen.detalleErrores.push({
      idExterno: "*",
      mensaje: e instanceof Error ? e.message : String(e),
    });
    await repo.finalizar(registroId, resumen);
    throw e;
  }

  await repo.finalizar(registroId, resumen);
  return resumen;
}
