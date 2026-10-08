import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import {
  listarCategorias,
  listarProductos,
  obtenerCategoria,
  type CategoriaSlug,
} from "@/modules/catalogo";

export async function generateStaticParams() {
  const categorias = await listarCategorias();
  return categorias.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  props: PageProps<"/categoria/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const categoria = await obtenerCategoria(slug);
  return { title: categoria?.nombre ?? "Categoría" };
}

export default async function PaginaCategoria(
  props: PageProps<"/categoria/[slug]">,
) {
  const { slug } = await props.params;
  const categoria = await obtenerCategoria(slug);
  if (!categoria) notFound();

  const productos = await listarProductos(categoria.slug as CategoriaSlug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-3xl">{categoria.nombre}</h1>
      <p className="mt-2 text-muted">{categoria.descripcion}</p>
      {productos.length === 0 ? (
        <p className="mt-8 text-muted">Aún no hay productos en esta categoría.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {productos.map((p) => (
            <li key={p.slug} className="flex">
              <ProductCard producto={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
