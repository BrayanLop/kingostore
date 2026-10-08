import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { listarCategorias, listarProductos } from "@/modules/catalogo";

export default async function Home() {
  const [categorias, productos] = await Promise.all([
    listarCategorias(),
    listarProductos(),
  ]);

  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">
            Envíos a toda Colombia
          </p>
          <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
            Todo lo que necesitas, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            Hogar, tecnología, mascotas, belleza y fitness. Elige lo que te
            gusta y paga cuando lo recibas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-serif text-2xl">Categorías</h2>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {categorias.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/categoria/${c.slug}`}
                className="block rounded-lg border border-border bg-surface p-4 text-center text-sm transition-colors hover:border-gold-dark hover:text-gold-light"
              >
                {c.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-serif text-2xl">Productos</h2>
        <p className="mt-2 text-sm text-muted">
          Catálogo de demostración: productos y precios de ejemplo.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {productos.map((p) => (
            <li key={p.slug} className="flex">
              <ProductCard producto={p} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
