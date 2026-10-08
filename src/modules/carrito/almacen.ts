"use client";

import { useSyncExternalStore } from "react";
import {
  agregarLinea, cambiarCantidad, leerCarrito, quitarLinea,
  type LineaCarrito,
} from "./logica";

// Almacén del carrito en localStorage, compartido entre componentes.
// useSyncExternalStore evita desajustes de hidratación: en el servidor el carrito
// siempre es vacío y el navegador lo actualiza al cargar.

const CLAVE = "kingostore.carrito.v1";
const VACIO: LineaCarrito[] = [];

let crudoActual: string | null | undefined;
let instantanea: LineaCarrito[] = VACIO;
const oyentes = new Set<() => void>();

function leerCrudo(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

function obtenerInstantanea(): LineaCarrito[] {
  const crudo = leerCrudo();
  if (crudo !== crudoActual) {
    crudoActual = crudo;
    instantanea = crudo ? leerCarrito(crudo) : VACIO;
  }
  return instantanea;
}

function guardar(carrito: LineaCarrito[]) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(carrito));
  } catch {
    // Sin almacenamiento: el carrito vive solo mientras la pestaña esté abierta.
    crudoActual = JSON.stringify(carrito);
    instantanea = carrito;
  }
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  const alCambiarOtraPestana = (e: StorageEvent) => {
    if (e.key === CLAVE) oyente();
  };
  window.addEventListener("storage", alCambiarOtraPestana);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", alCambiarOtraPestana);
  };
}

export function useCarrito(): LineaCarrito[] {
  return useSyncExternalStore(suscribir, obtenerInstantanea, () => VACIO);
}

export const acciones = {
  agregar(nueva: Omit<LineaCarrito, "cantidad">, cantidad = 1) {
    guardar(agregarLinea(obtenerInstantanea(), nueva, cantidad));
  },
  cambiarCantidad(varianteId: string, cantidad: number) {
    guardar(cambiarCantidad(obtenerInstantanea(), varianteId, cantidad));
  },
  quitar(varianteId: string) {
    guardar(quitarLinea(obtenerInstantanea(), varianteId));
  },
  vaciar() {
    guardar([]);
  },
};
