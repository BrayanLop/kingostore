export interface ItemSolicitud {
  varianteId: string;
  cantidad: number;
}

export interface SolicitudPedido {
  cliente: {
    nombre: string;
    telefono: string;
    correo?: string;
    consentimientoDatos: boolean;
  };
  direccion: {
    departamento: string;
    ciudad: string;
    direccion: string;
    notas?: string;
  };
  items: ItemSolicitud[];
  notas?: string;
  /** Total que vio el cliente en pantalla; si no coincide con la base, se rechaza. */
  totalEsperado: number;
}

export type CodigoErrorPedido =
  | "sin_base_datos"
  | "stock_insuficiente"
  | "producto_no_disponible"
  | "precio_cambio"
  | "datos_invalidos"
  | "error_interno";

export class ErrorPedido extends Error {
  constructor(
    readonly codigo: CodigoErrorPedido,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorPedido";
  }
}

export const MENSAJES_ERROR: Record<CodigoErrorPedido, string> = {
  sin_base_datos:
    "La tienda está en modo demostración: todavía no se pueden crear pedidos.",
  stock_insuficiente:
    "Alguno de los productos ya no tiene unidades suficientes. Revisa tu carrito.",
  producto_no_disponible:
    "Alguno de los productos ya no está disponible. Revisa tu carrito.",
  precio_cambio:
    "Los precios cambiaron mientras comprabas. Revisa el total y vuelve a confirmar.",
  datos_invalidos: "Revisa los datos del formulario.",
  error_interno:
    "No pudimos crear tu pedido. Inténtalo de nuevo en unos minutos.",
};

export interface PedidoCreado {
  numero: number;
  token: string;
  total: number;
}

export interface PedidoConsulta {
  numero: number;
  estado: string;
  metodoPago: string;
  subtotal: number;
  flete: number;
  total: number;
  creadoEn: string;
  cliente: string;
  direccion: string;
  items: { nombre: string; cantidad: number; precioUnitario: number }[];
  historial: { estado: string; fecha: string }[];
  envios: { guia: string | null; transportadora: string | null }[];
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_pago: "Pendiente de pago",
  por_confirmar: "Por confirmar",
  pagado: "Pago recibido",
  confirmado: "Confirmado",
  enviado_a_proveedor: "En preparación",
  despachado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devuelto: "Devuelto",
  // Detalle interno: al cliente se le muestra como un pedido en revisión.
  fallo_proveedor: "En revisión",
};
