import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agregarLinea, cambiarCantidad, leerCarrito, quitarLinea, subtotal, totalUnidades, MAX_POR_LINEA,
} from "./logica";

const base = { varianteId: "v1", slug: "a", nombre: "A", detalle: "", precio: 10000 };

test("agregar suma cantidades de la misma variante", () => {
  let c = agregarLinea([], base);
  c = agregarLinea(c, base, 2);
  assert.equal(c.length, 1);
  assert.equal(c[0].cantidad, 3);
});

test("la cantidad no supera el mÃ¡ximo por lÃ­nea", () => {
  const c = agregarLinea(agregarLinea([], base, 15), base, 15);
  assert.equal(c[0].cantidad, MAX_POR_LINEA);
});

test("cambiar a 0 o negativo quita la lÃ­nea", () => {
  const c = agregarLinea([], base);
  assert.deepEqual(cambiarCantidad(c, "v1", 0), []);
  assert.deepEqual(cambiarCantidad(c, "v1", -3), []);
});

test("subtotal y unidades", () => {
  let c = agregarLinea([], base, 2);
  c = agregarLinea(c, { ...base, varianteId: "v2", precio: 5000 }, 1);
  assert.equal(subtotal(c), 25000);
  assert.equal(totalUnidades(c), 3);
  assert.equal(quitarLinea(c, "v1").length, 1);
});

test("leerCarrito descarta datos invÃ¡lidos", () => {
  assert.deepEqual(leerCarrito(null), []);
  assert.deepEqual(leerCarrito("no es json"), []);
  assert.deepEqual(leerCarrito('{"a":1}'), []);
  const mezcla = JSON.stringify([
    { ...base, cantidad: 2 },
    { ...base, varianteId: "x", cantidad: -1 },
    { ...base, varianteId: "y", cantidad: 1, precio: 1.5 },
    { varianteId: 5 },
  ]);
  const r = leerCarrito(mezcla);
  assert.equal(r.length, 1);
  assert.equal(r[0].varianteId, "v1");
});
