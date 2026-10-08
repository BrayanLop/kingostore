"use client";

import Link from "next/link";
import { useState } from "react";
import type { Variante } from "@/modules/catalogo";
import { acciones } from "@/modules/carrito/almacen";
import { formatearCop } from "@/modules/precios";

function textoVariante(v: Variante): string {
  return Object.values(v.atributos).join(", ");
}

export function AgregarAlCarrito({
  slug,
  nombre,
  variantes,
}: {
  slug: string;
  nombre: string;
  variantes: Variante[];
}) {
  const disponibles = variantes.filter((v) => v.stock > 0);
  const [varianteId, setVarianteId] = useState(disponibles[0]?.id ?? "");
  const [agregado, setAgregado] = useState(false);
  const elegida = variantes.find((v) => v.id === varianteId);

  if (disponibles.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-border px-4 py-3 text-sm text-muted">
        Producto agotado por ahora.
      </p>
    );
  }

  return (
    <div className="mt-8">
      {variantes.length > 1 && (
        <div className="mb-4">
          <label htmlFor="variante" className="mb-1 block text-sm text-muted">
            Opción
          </label>
          <select
            id="variante"
            value={varianteId}
            onChange={(e) => {
              setVarianteId(e.target.value);
              setAgregado(false);
            }}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto"
          >
            {variantes.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                {textoVariante(v) || "Estándar"} · {formatearCop(v.precio)}
                {v.stock <= 0 ? " (agotado)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (!elegida) return;
            acciones.agregar({
              varianteId: elegida.id,
              slug,
              nombre,
              detalle: textoVariante(elegida),
              precio: elegida.precio,
            });
            setAgregado(true);
          }}
          className="rounded-lg bg-gold px-6 py-3 font-medium text-background transition-colors hover:bg-gold-light"
        >
          Agregar al carrito
        </button>
        {agregado && (
          <p role="status" className="text-sm text-gold-light">
            Agregado.{" "}
            <Link href="/carrito" className="underline">
              Ver carrito
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
