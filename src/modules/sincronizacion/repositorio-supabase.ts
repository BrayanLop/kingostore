import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReglaPrecio } from "@/modules/precios";
import type {
  DatosProductoNuevo,
  DatosVariante,
  ProductoExistente,
  RepositorioSync,
  ResumenSync,
} from "./sincronizar";

// Implementación de RepositorioSync sobre Supabase. Recibe el cliente ya creado
// (con la llave de servicio) para no depender de `server-only` y poder usarse
// también desde scripts de línea de comandos.

function fallar(contexto: string, error: { message: string }): never {
  throw new Error(`${contexto}: ${error.message}`);
}

export function crearRepositorioSupabase(db: SupabaseClient): RepositorioSync {
  return {
    async iniciar(proveedorId) {
      const { data, error } = await db
        .from("registros_sync")
        .insert({ proveedor_id: proveedorId })
        .select("id")
        .single();
      if (error) fallar("No se pudo iniciar el registro de sincronización", error);
      return data.id as string;
    },

    async reglasDePrecio() {
      const { data, error } = await db
        .from("reglas_precio")
        .select("alcance, categoria_id, producto_id, margen_min, redondeo")
        .eq("activo", true);
      if (error) fallar("No se pudieron leer las reglas de precio", error);
      return (data ?? []).map(
        (r): ReglaPrecio => ({
          alcance: r.alcance,
          categoriaId: r.categoria_id,
          productoId: r.producto_id,
          margenMin: Number(r.margen_min),
          redondeo: r.redondeo,
        }),
      );
    },

    async buscarProducto(proveedorId, idExterno): Promise<ProductoExistente | null> {
      const { data, error } = await db
        .from("productos")
        .select("id, categoria_id, variantes(id, id_externo)")
        .eq("proveedor_id", proveedorId)
        .eq("id_externo", idExterno)
        .maybeSingle();
      if (error) fallar("No se pudo buscar el producto", error);
      if (!data) return null;
      return {
        id: data.id,
        categoriaId: data.categoria_id,
        variantes: (data.variantes ?? []).map(
          (v: { id: string; id_externo: string | null }) => ({
            id: v.id,
            idExterno: v.id_externo,
          }),
        ),
      };
    },

    async crearProducto(d: DatosProductoNuevo) {
      const { data, error } = await db
        .from("productos")
        .insert({
          proveedor_id: d.proveedorId,
          id_externo: d.idExterno,
          slug: d.slug,
          nombre: d.nombre,
          descripcion: d.descripcion,
          imagenes: d.imagenes,
          estado: "borrador", // nunca se publica solo
        })
        .select("id")
        .single();
      if (error) fallar("No se pudo crear el producto", error);
      return data.id as string;
    },

    async guardarVariante(productoId, v: DatosVariante) {
      const { error } = await db.from("variantes").upsert(
        {
          producto_id: productoId,
          id_externo: v.idExterno,
          sku: v.sku ?? null,
          atributos: v.atributos,
          costo: v.costo,
          precio_venta: v.precioVenta,
          stock: v.stock,
          activo: true,
        },
        { onConflict: "producto_id,id_externo" },
      );
      if (error) fallar("No se pudo guardar la variante", error);
    },

    async ponerSinStock(varianteIds) {
      const { error } = await db
        .from("variantes")
        .update({ stock: 0 })
        .in("id", varianteIds);
      if (error) fallar("No se pudo poner en cero el stock", error);
    },

    async finalizar(registroId, r: ResumenSync) {
      const { error } = await db
        .from("registros_sync")
        .update({
          fin: new Date().toISOString(),
          creados: r.productosCreados,
          actualizados: r.productosActualizados,
          errores: r.errores,
          detalle: r,
        })
        .eq("id", registroId);
      if (error) fallar("No se pudo cerrar el registro de sincronización", error);
    },
  };
}
