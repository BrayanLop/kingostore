import "server-only";
import { crearClienteServicio } from "@/lib/supabase/servidor";
import { calcularFlete } from "@/modules/envios/config";
import {
  ErrorPedido,
  type PedidoConsulta,
  type PedidoCreado,
  type SolicitudPedido,
} from "./tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

function clienteOError() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new ErrorPedido("sin_base_datos", "Supabase no está configurado");
  }
  return crearClienteServicio();
}

/** Precio real (de la base) de cada variante pedida; nunca el que manda el navegador. */
async function subtotalReal(
  db: ReturnType<typeof crearClienteServicio>,
  items: SolicitudPedido["items"],
): Promise<number> {
  const ids = [...new Set(items.map((i) => i.varianteId))];
  const { data, error } = await db
    .from("variantes")
    .select("id, precio_venta")
    .in("id", ids);
  if (error) throw new ErrorPedido("error_interno", error.message);
  const precios = new Map(
    (data ?? []).map((v) => [v.id as string, v.precio_venta as number]),
  );
  let suma = 0;
  for (const item of items) {
    const precio = precios.get(item.varianteId);
    if (precio === undefined) {
      throw new ErrorPedido("producto_no_disponible", item.varianteId);
    }
    suma += precio * item.cantidad;
  }
  return suma;
}

export async function crearPedido(
  solicitud: SolicitudPedido,
): Promise<PedidoCreado> {
  const db = clienteOError();

  // El flete depende del subtotal REAL, no del que diga el navegador.
  const subtotal = await subtotalReal(db, solicitud.items);
  const flete = calcularFlete(subtotal);

  if (subtotal + flete !== solicitud.totalEsperado) {
    throw new ErrorPedido("precio_cambio", "El total mostrado ya no coincide");
  }

  const { data, error } = await db.rpc("crear_pedido", {
    p_cliente: {
      nombre: solicitud.cliente.nombre,
      telefono: solicitud.cliente.telefono,
      correo: solicitud.cliente.correo ?? null,
      consentimiento_datos: solicitud.cliente.consentimientoDatos,
    },
    p_direccion: solicitud.direccion,
    p_items: solicitud.items.map((i) => ({
      variante_id: i.varianteId,
      cantidad: i.cantidad,
    })),
    p_metodo: "contra_entrega",
    p_flete: flete,
    p_notas: solicitud.notas ?? null,
    p_total_esperado: solicitud.totalEsperado,
  });

  if (error) {
    const mensaje = error.message ?? "";
    if (mensaje.includes("stock_insuficiente")) {
      throw new ErrorPedido("stock_insuficiente", mensaje);
    }
    if (mensaje.includes("producto_no_disponible")) {
      throw new ErrorPedido("producto_no_disponible", mensaje);
    }
    if (mensaje.includes("precio_cambio")) {
      throw new ErrorPedido("precio_cambio", mensaje);
    }
    if (
      /consentimiento_requerido|datos_cliente_incompletos|direccion_incompleta|carrito_vacio|items_invalidos|flete_invalido/.test(
        mensaje,
      )
    ) {
      throw new ErrorPedido("datos_invalidos", mensaje);
    }
    console.error("[pedidos] crear_pedido falló:", mensaje);
    throw new ErrorPedido("error_interno", mensaje);
  }

  const r = data as { numero: number; token_seguimiento: string; total: number };
  return { numero: r.numero, token: r.token_seguimiento, total: r.total };
}

interface FilaPedido {
  numero: number;
  estado: string;
  metodo_pago: string;
  subtotal: number;
  flete: number;
  total: number;
  creado_en: string;
  clientes: { nombre: string } | null;
  direcciones: {
    departamento: string;
    ciudad: string;
    direccion: string;
  } | null;
  items_pedido: { nombre: string; cantidad: number; precio_unitario: number }[];
  historial_estados_pedido: { estado_nuevo: string; creado_en: string }[];
  pedidos_proveedor: { guia: string | null; transportadora: string | null }[];
}

/** Consulta pública por token secreto. No expone costos, proveedores ni notas internas. */
export async function obtenerPedidoPorToken(
  token: string,
): Promise<PedidoConsulta | null> {
  if (!esUuid(token)) return null;
  const db = clienteOError();
  const { data, error } = await db
    .from("pedidos")
    .select(
      `numero, estado, metodo_pago, subtotal, flete, total, creado_en,
       clientes(nombre),
       direcciones(departamento, ciudad, direccion),
       items_pedido(nombre, cantidad, precio_unitario),
       historial_estados_pedido(estado_nuevo, creado_en),
       pedidos_proveedor(guia, transportadora)`,
    )
    .eq("token_seguimiento", token)
    .maybeSingle();
  if (error) {
    console.error("[pedidos] consulta falló:", error.message);
    throw new ErrorPedido("error_interno", error.message);
  }
  if (!data) return null;
  const f = data as unknown as FilaPedido;
  return {
    numero: f.numero,
    estado: f.estado,
    metodoPago: f.metodo_pago,
    subtotal: f.subtotal,
    flete: f.flete,
    total: f.total,
    creadoEn: f.creado_en,
    cliente: f.clientes?.nombre ?? "",
    direccion: f.direcciones
      ? `${f.direcciones.direccion}, ${f.direcciones.ciudad}, ${f.direcciones.departamento}`
      : "",
    items: f.items_pedido.map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    })),
    historial: [...f.historial_estados_pedido]
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
      .map((h) => ({ estado: h.estado_nuevo, fecha: h.creado_en })),
    envios: f.pedidos_proveedor
      .filter((p) => p.guia || p.transportadora)
      .map((p) => ({ guia: p.guia, transportadora: p.transportadora })),
  };
}
