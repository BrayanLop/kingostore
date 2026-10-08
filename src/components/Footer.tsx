import Link from "next/link";

const enlaces = [
  { href: "/politicas/terminos", texto: "Términos y condiciones" },
  { href: "/politicas/privacidad", texto: "Política de privacidad" },
  { href: "/politicas/envios-y-devoluciones", texto: "Envíos y devoluciones" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>KingoStore · Envíos a toda Colombia</p>
        <nav aria-label="Información legal" className="flex flex-wrap gap-x-6 gap-y-2">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} className="transition-colors hover:text-gold-light">
              {e.texto}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
