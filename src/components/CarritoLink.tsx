"use client";

import Link from "next/link";
import { totalUnidades } from "@/modules/carrito/logica";
import { useCarrito } from "@/modules/carrito/almacen";

export function CarritoLink() {
  const unidades = totalUnidades(useCarrito());
  return (
    <Link
      href="/carrito"
      className="relative rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-gold-dark hover:text-gold-light"
      aria-label={`Carrito, ${unidades} ${unidades === 1 ? "producto" : "productos"}`}
    >
      Carrito
      {unidades > 0 && (
        <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-medium text-background">
          {unidades}
        </span>
      )}
    </Link>
  );
}
