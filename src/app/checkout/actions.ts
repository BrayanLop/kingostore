"use server";

import { redirect } from "next/navigation";
import { DEPARTAMENTOS } from "@/modules/envios/config";
import { crearPedido } from "@/modules/pedidos/servicio";
import {
  ErrorPedido,
  MENSAJES_ERROR,
  type ItemSolicitud,
} from "@/modules/pedidos/tipos";

export interface EstadoCheckout {
  error?: string;
  /** Valores enviados, para no obligar al cliente a escribir todo de nuevo. */
  valores?: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(datos: FormData, campo: string): string {
  const v = datos.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

function leerItems(crudo: string): ItemSolicitud[] | null {
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!Array.isArray(datos) || datos.length === 0 || datos.length > 50) {
    return null;
  }
  const items: ItemSolicitud[] = [];
  for (const d of datos) {
    if (
      !d ||
      typeof d.varianteId !== "string" ||
      !UUID.test(d.varianteId) ||
      !Number.isInteger(d.cantidad) ||
      d.cantidad < 1 ||
      d.cantidad > 20
    ) {
      return null;
    }
    items.push({ varianteId: d.varianteId, cantidad: d.cantidad });
  }
  return items;
}

export async function crearPedidoAction(
  _anterior: EstadoCheckout,
  datos: FormData,
): Promise<EstadoCheckout> {
  const valores: Record<string, string> = {
    nombre: texto(datos, "nombre"),
    telefono: texto(datos, "telefono"),
    correo: texto(datos, "correo"),
    departamento: texto(datos, "departamento"),
    ciudad: texto(datos, "ciudad"),
    direccion: texto(datos, "direccion"),
    notas: texto(datos, "notas"),
  };
  const fallo = (error: string): EstadoCheckout => ({ error, valores });

  // Campo trampa: las personas no lo ven ni lo llenan; muchos bots sí.
  if (texto(datos, "sitio_web") !== "") {
    return fallo(MENSAJES_ERROR.error_interno);
  }

  const items = leerItems(texto(datos, "items"));
  if (!items) return fallo("Tu carrito está vacío o es inválido.");

  const telefono = valores.telefono.replace(/[\s()-]/g, "");
  if (valores.nombre.length < 3) return fallo("Escribe tu nombre completo.");
  if (!/^\+?\d{7,15}$/.test(telefono)) {
    return fallo("Escribe un teléfono válido (solo números).");
  }
  if (valores.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo)) {
    return fallo("El correo no parece válido.");
  }
  if (!(DEPARTAMENTOS as readonly string[]).includes(valores.departamento)) {
    return fallo("Elige un departamento.");
  }
  if (valores.ciudad.length < 2) return fallo("Escribe tu ciudad o municipio.");
  if (valores.direccion.length < 6) return fallo("Escribe tu dirección completa.");
  if (datos.get("acepto") !== "on") {
    return fallo("Debes aceptar los términos y la política de privacidad.");
  }

  const totalEsperado = Number(texto(datos, "totalEsperado"));
  if (!Number.isInteger(totalEsperado) || totalEsperado < 0) {
    return fallo("No pudimos verificar el total. Recarga la página.");
  }

  let token: string;
  try {
    const pedido = await crearPedido({
      cliente: {
        nombre: valores.nombre,
        telefono,
        correo: valores.correo || undefined,
        consentimientoDatos: true,
      },
      direccion: {
        departamento: valores.departamento,
        ciudad: valores.ciudad,
        direccion: valores.direccion,
        notas: valores.notas || undefined,
      },
      items,
      notas: undefined,
      totalEsperado,
    });
    token = pedido.token;
  } catch (e) {
    if (e instanceof ErrorPedido) return fallo(MENSAJES_ERROR[e.codigo]);
    console.error("[checkout] error inesperado:", e);
    return fallo(MENSAJES_ERROR.error_interno);
  }

  // redirect() lanza una excepción interna de Next: debe ir fuera del try/catch.
  redirect(`/pedido/${token}?nuevo=1`);
}
