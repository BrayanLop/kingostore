import Link from "next/link";
import type { Producto } from "@/modules/catalogo";
import { formatearCop } from "@/modules/precios";

export function ProductCard({ producto }: { producto: Producto }) {
  return (
    <Link
      href={`/producto/${producto.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-gold-dark"
    >
      <div
        aria-hidden="true"
        className="flex aspect-square items-center justify-center bg-gradient-to-br from-surface to-background"
      >
        <span className="font-serif text-5xl text-gold-dark transition-colors group-hover:text-gold">
          {producto.nombre.charAt(0)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-medium leading-snug">{producto.nombre}</h3>
        <p className="mt-auto font-serif text-lg text-gold-light">
          {formatearCop(producto.precio)}
        </p>
      </div>
    </Link>
  );
}
