import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VaciarCarrito } from "@/components/VaciarCarrito";
import { formatearCop } from "@/modules/precios";
import { obtenerPedidoPorToken } from "@/modules/pedidos/servicio";
import { ETIQUETA_ESTADO } from "@/modules/pedidos/tipos";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

const fechaHora = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function enlaceWhatsApp(numeroPedido: number): string | null {
  const numero = (process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? "").replace(/\D/g, "");
  if (!numero) return null;
  const texto = `Hola, quiero confirmar mi pedido #${numeroPedido} de KingoStore.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

async function Contenido(props: PageProps<"/pedido/[token]">) {
  const { token } = await props.params;
  const { nuevo } = await props.searchParams;
  const pedido = await obtenerPedidoPorToken(token);
  if (!pedido) notFound();

  const whatsapp =
    pedido.estado === "por_confirmar" ? enlaceWhatsApp(pedido.numero) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {nuevo === "1" && <VaciarCarrito />}

      <p className="text-sm uppercase tracking-[0.3em] text-gold">
        {nuevo === "1" ? "¡Gracias por tu compra!" : "Seguimiento"}
      </p>
      <h1 className="mt-2 font-serif text-3xl">Pedido #{pedido.numero}</h1>
      <p className="mt-2 text-muted">
        Estado:{" "}
        <strong className="text-foreground">
          {ETIQUETA_ESTADO[pedido.estado] ?? pedido.estado}
        </strong>
      </p>

      {pedido.estado === "por_confirmar" && (
        <div className="mt-6 rounded-lg border border-gold-dark bg-surface p-4 text-sm">
          <p>
            Te escribiremos por WhatsApp para confirmar tus datos antes de
            enviar tu pedido. Pagas cuando lo recibas.
          </p>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-gold px-4 py-2 font-medium text-background hover:bg-gold-light"
            >
              Confirmar por WhatsApp
            </a>
          )}
        </div>
      )}

      {pedido.envios.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-xl">Envío</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {pedido.envios.map((e, i) => (
              <li key={i}>
                {e.transportadora ?? "Transportadora"}
                {e.guia && <> · Guía <strong>{e.guia}</strong></>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-serif text-xl">Productos</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface text-sm">
          {pedido.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-4 p-4">
              <span>
                {i.cantidad} × {i.nombre}
              </span>
              <span className="whitespace-nowrap">
                {formatearCop(i.precioUnitario * i.cantidad)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatearCop(pedido.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Envío</dt>
            <dd>{pedido.flete === 0 ? "Gratis" : formatearCop(pedido.flete)}</dd>
          </div>
          <div className="flex justify-between font-serif text-lg text-gold-light">
            <dt>Total a pagar</dt>
            <dd>{formatearCop(pedido.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 text-sm">
        <h2 className="font-serif text-xl">Entrega</h2>
        <p className="mt-3">{pedido.cliente}</p>
        <p className="text-muted">{pedido.direccion}</p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl">Historial</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {pedido.historial.map((h, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>{ETIQUETA_ESTADO[h.estado] ?? h.estado}</span>
              <time className="text-muted" dateTime={h.fecha}>
                {fechaHora.format(new Date(h.fecha))}
              </time>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-10 text-xs text-muted">
        Guarda este enlace: es la forma de consultar tu pedido.
      </p>
    </div>
  );
}

export default function PaginaPedido(props: PageProps<"/pedido/[token]">) {
  return (
    <Suspense
      fallback={<div className="mx-auto max-w-3xl px-4 py-12 text-muted">Cargando tu pedido...</div>}
    >
      <Contenido {...props} />
    </Suspense>
  );
}
