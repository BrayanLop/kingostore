import type { Metadata } from "next";
import { FormularioCheckout } from "@/components/FormularioCheckout";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  robots: { index: false },
};

export default function PaginaCheckout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-8 font-serif text-3xl">Finalizar pedido</h1>
      <FormularioCheckout />
    </div>
  );
}
