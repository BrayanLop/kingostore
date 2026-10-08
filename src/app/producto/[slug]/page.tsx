import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgregarAlCarrito } from "@/components/AgregarAlCarrito";
import {
  listarProductos,
  obtenerCategoria,
  obtenerProducto,
} from "@/modules/catalogo";
import { formatearCop } from "@/modules/precios";

export async function generateStaticParams() {
  const productos = await listarProductos();
  return productos.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/producto/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const producto = await obtenerProducto(slug);
  return {
    title: producto?.nombre ?? "Producto",
    description: producto?.descripcion,
  };
}

export default async function PaginaProducto(
  props: PageProps<"/producto/[slug]">,
) {
  const { slug } = await props.params;
  const producto = await obtenerProducto(slug);
  if (!producto) notFound();

  const categoria = await obtenerCategoria(producto.categoria);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {categoria && (
        <Link
          href={`/categoria/${categoria.slug}`}
          className="text-sm text-muted transition-colors hover:text-gold-light"
        >
          ← {categoria.nombre}
        </Link>
      )}
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div
          aria-hidden="true"
          className="flex aspect-square items-center justify-center rounded-lg border border-border bg-gradient-to-br from-surface to-background"
        >
          <span className="font-serif text-8xl text-gold-dark">
            {producto.nombre.charAt(0)}
          </span>
        </div>
        <div>
          <h1 className="font-serif text-3xl leading-tight">{producto.nombre}</h1>
          <p className="mt-4 font-serif text-3xl text-gold-light">
            {producto.variantes.length > 1 ? "Desde " : ""}
            {formatearCop(producto.precio)}
          </p>
          <p className="mt-6 text-muted">{producto.descripcion}</p>
          <AgregarAlCarrito
            slug={producto.slug}
            nombre={producto.nombre}
            variantes={producto.variantes}
          />
          {producto.demo && (
            <p className="mt-4 text-xs text-muted">
              Producto de demostración: precio y descripción de ejemplo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
