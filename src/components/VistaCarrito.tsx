"use client";

import Link from "next/link";
import { acciones, useCarrito } from "@/modules/carrito/almacen";
import { subtotal } from "@/modules/carrito/logica";
import { calcularFlete } from "@/modules/envios/config";
import { formatearCop } from "@/modules/precios";

export function VistaCarrito() {
  const carrito = useCarrito();

  if (carrito.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <p>Tu carrito está vacío.</p>
        <Link href="/" className="mt-3 inline-block text-gold-light underline">
          Ver productos
        </Link>
      </div>
    );
  }

  const sub = subtotal(carrito);
  const flete = calcularFlete(sub);

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_320px]">
      <ul className="space-y-4">
        {carrito.map((l) => (
          <li
            key={l.varianteId}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4"
          >
            <div className="min-w-0">
              <Link
                href={`/producto/${l.slug}`}
                className="font-medium hover:text-gold-light"
              >
                {l.nombre}
              </Link>
              {l.detalle && <p className="text-sm text-muted">{l.detalle}</p>}
              <p className="mt-1 text-sm text-gold-light">
                {formatearCop(l.precio)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="sr-only" htmlFor={`cant-${l.varianteId}`}>
                Cantidad de {l.nombre}
              </label>
              <input
                id={`cant-${l.varianteId}`}
                type="number"
                min={1}
                max={20}
                value={l.cantidad}
                onChange={(e) =>
                  acciones.cambiarCantidad(l.varianteId, Number(e.target.value))
                }
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center"
              />
              <button
                type="button"
                onClick={() => acciones.quitar(l.varianteId)}
                className="text-sm text-muted underline hover:text-foreground"
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-lg border border-border bg-surface p-5">
        <h2 className="font-serif text-xl">Resumen</h2>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatearCop(sub)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Envío</dt>
            <dd>{flete === 0 ? "Gratis" : formatearCop(flete)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 font-serif text-lg text-gold-light">
            <dt>Total</dt>
            <dd>{formatearCop(sub + flete)}</dd>
          </div>
        </dl>
        <Link
          href="/checkout"
          className="mt-5 block rounded-lg bg-gold px-6 py-3 text-center font-medium text-background transition-colors hover:bg-gold-light"
        >
          Continuar con el pedido
        </Link>
        <p className="mt-3 text-xs text-muted">
          Pago contra entrega. El total final lo confirma el servidor con los
          precios vigentes.
        </p>
      </aside>
    </div>
  );
}
