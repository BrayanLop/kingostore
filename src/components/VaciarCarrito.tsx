"use client";

import { useEffect } from "react";
import { acciones } from "@/modules/carrito/almacen";

/** Vacía el carrito una vez, al llegar a la confirmación de un pedido nuevo. */
export function VaciarCarrito() {
  useEffect(() => {
    acciones.vaciar();
  }, []);
  return null;
}
