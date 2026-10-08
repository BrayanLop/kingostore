import Image from "next/image";
import Link from "next/link";
import { listarCategorias } from "@/modules/catalogo";
import { CarritoLink } from "./CarritoLink";

export async function Header() {
  const categorias = await listarCategorias();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-2">
        <Link href="/" aria-label="KingoStore, ir al inicio">
          <Image
            src="/brand/logo.png"
            alt="KingoStore"
            width={115}
            height={46}
            priority
          />
        </Link>
        <nav
          aria-label="Categorías"
          className="hidden gap-6 text-sm text-muted md:flex"
        >
          {categorias.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="transition-colors hover:text-gold-light"
            >
              {c.nombre}
            </Link>
          ))}
        </nav>
        <CarritoLink />
      </div>
    </header>
  );
}
