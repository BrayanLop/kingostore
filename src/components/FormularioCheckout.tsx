"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  crearPedidoAction,
  type EstadoCheckout,
} from "@/app/checkout/actions";
import { acciones, useCarrito } from "@/modules/carrito/almacen";
import { subtotal } from "@/modules/carrito/logica";
import { calcularFlete, DEPARTAMENTOS } from "@/modules/envios/config";
import { formatearCop } from "@/modules/precios";

const ESTADO_INICIAL: EstadoCheckout = {};

const campo =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted focus:border-gold focus:outline-none";

export function FormularioCheckout() {
  const carrito = useCarrito();
  const [estado, accion, enviando] = useActionState(
    crearPedidoAction,
    ESTADO_INICIAL,
  );

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
  const total = sub + flete;
  const v = estado.valores ?? {};

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_340px]">
      <form action={accion} className="space-y-5">
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(
            carrito.map((l) => ({
              varianteId: l.varianteId,
              cantidad: l.cantidad,
            })),
          )}
        />
        <input type="hidden" name="totalEsperado" value={total} />
        {/* Campo trampa anti-bots: oculto para personas. */}
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label>
            No llenar
            <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {estado.error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {estado.error}
          </p>
        )}

        <fieldset className="space-y-4">
          <legend className="font-serif text-xl">Tus datos</legend>
          <div>
            <label htmlFor="nombre" className="mb-1 block text-sm text-muted">
              Nombre completo
            </label>
            <input id="nombre" name="nombre" required autoComplete="name"
              defaultValue={v.nombre} className={campo} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="telefono" className="mb-1 block text-sm text-muted">
                Teléfono / WhatsApp
              </label>
              <input id="telefono" name="telefono" required type="tel"
                inputMode="tel" autoComplete="tel" defaultValue={v.telefono}
                className={campo} />
            </div>
            <div>
              <label htmlFor="correo" className="mb-1 block text-sm text-muted">
                Correo (opcional)
              </label>
              <input id="correo" name="correo" type="email" autoComplete="email"
                defaultValue={v.correo} className={campo} />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-serif text-xl">Dónde lo recibes</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="departamento" className="mb-1 block text-sm text-muted">
                Departamento
              </label>
              <select id="departamento" name="departamento" required
                defaultValue={v.departamento ?? ""} className={campo}>
                <option value="" disabled>
                  Elige uno
                </option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ciudad" className="mb-1 block text-sm text-muted">
                Ciudad o municipio
              </label>
              <input id="ciudad" name="ciudad" required
                autoComplete="address-level2" defaultValue={v.ciudad}
                className={campo} />
            </div>
          </div>
          <div>
            <label htmlFor="direccion" className="mb-1 block text-sm text-muted">
              Dirección
            </label>
            <input id="direccion" name="direccion" required
              autoComplete="street-address" defaultValue={v.direccion}
              placeholder="Calle, número, barrio, apartamento..." className={campo} />
          </div>
          <div>
            <label htmlFor="notas" className="mb-1 block text-sm text-muted">
              Indicaciones para el envío (opcional)
            </label>
            <textarea id="notas" name="notas" rows={2} defaultValue={v.notas}
              className={campo} />
          </div>
        </fieldset>

        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-medium">Pago contra entrega</p>
          <p className="mt-1 text-muted">
            Pagas cuando recibes tu pedido. Te escribiremos por WhatsApp para
            confirmar tus datos antes de enviarlo.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acepto" required className="mt-1" />
          <span>
            Acepto los{" "}
            <Link href="/politicas/terminos" className="text-gold-light underline" target="_blank">
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link href="/politicas/privacidad" className="text-gold-light underline" target="_blank">
              política de privacidad
            </Link>
            , y autorizo el tratamiento de mis datos para gestionar este pedido.
          </span>
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-gold px-6 py-3 font-medium text-background transition-colors hover:bg-gold-light disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {enviando ? "Creando tu pedido..." : `Confirmar pedido · ${formatearCop(total)}`}
        </button>
      </form>

      <aside className="h-fit rounded-lg border border-border bg-surface p-5">
        <h2 className="font-serif text-xl">Resumen</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {carrito.map((l) => (
            <li key={l.varianteId} className="flex justify-between gap-3">
              <span>
                {l.cantidad} × {l.nombre}
                {l.detalle && <span className="text-muted"> ({l.detalle})</span>}
              </span>
              <span className="whitespace-nowrap">
                {formatearCop(l.precio * l.cantidad)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatearCop(sub)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Envío</dt>
            <dd>{flete === 0 ? "Gratis" : formatearCop(flete)}</dd>
          </div>
          <div className="flex justify-between pt-2 font-serif text-lg text-gold-light">
            <dt>Total</dt>
            <dd>{formatearCop(total)}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => acciones.vaciar()}
          className="mt-4 text-xs text-muted underline hover:text-foreground"
        >
          Vaciar carrito
        </button>
      </aside>
    </div>
  );
}
