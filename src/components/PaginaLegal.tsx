import type { ReactNode } from "react";

// Mientras sea true, las páginas legales muestran un aviso de borrador.
// Cambiar a false SOLO cuando un abogado las haya revisado y se hayan completado
// los datos entre corchetes (razón social, NIT, correo, WhatsApp).
const BORRADOR_PENDIENTE_REVISION = true;

export function PaginaLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-3xl">{titulo}</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: {actualizado}</p>
      {BORRADOR_PENDIENTE_REVISION && (
        <p
          role="note"
          className="mt-6 rounded-lg border border-gold-dark bg-surface px-4 py-3 text-sm"
        >
          Borrador pendiente de revisión legal. Los datos entre corchetes
          [así] se completan antes del lanzamiento.
        </p>
      )}
      <div className="mt-8 space-y-4 leading-relaxed text-muted [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
