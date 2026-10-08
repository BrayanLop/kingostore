import type { Metadata } from "next";
import { VistaCarrito } from "@/components/VistaCarrito";

export const metadata: Metadata = { title: "Carrito" };

export default function PaginaCarrito() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-8 font-serif text-3xl">Tu carrito</h1>
      <VistaCarrito />
    </div>
  );
}
