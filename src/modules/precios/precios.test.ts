import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularPrecioVenta, margenReal, REGLA_POR_DEFECTO, resolverRegla,
  type ReglaPrecio,
} from "./index";

test("el precio calculado cumple el margen mínimo y redondea hacia arriba", () => {
  const precio = calcularPrecioVenta({ costo: 30000, margenMin: 35, redondeo: 100 });
  assert.equal(precio % 100, 0);
  assert.ok(margenReal(precio, 30000) >= 35);
  assert.equal(precio, 46200);
});

test("nunca queda por debajo del margen aunque el redondeo sea grande", () => {
  for (const costo of [1000, 12345, 29999, 87654]) {
    for (const margen of [10, 30, 40, 55]) {
      const p = calcularPrecioVenta({ costo, margenMin: margen, redondeo: 1000 });
      assert.ok(margenReal(p, costo) >= margen - 1e-9, `costo ${costo} margen ${margen}`);
    }
  }
});

test("los costos adicionales (flete, comisión) suben el precio", () => {
  const sin = calcularPrecioVenta({ costo: 20000, margenMin: 30, redondeo: 100 });
  const con = calcularPrecioVenta({
    costo: 20000, margenMin: 30, redondeo: 100, costosAdicionales: 8000,
  });
  assert.ok(con > sin);
  assert.ok(margenReal(con, 20000, 8000) >= 30);
});

test("rechaza entradas inválidas", () => {
  assert.throws(() => calcularPrecioVenta({ costo: -1, margenMin: 30, redondeo: 100 }));
  assert.throws(() => calcularPrecioVenta({ costo: 100, margenMin: 100, redondeo: 100 }));
  assert.throws(() => calcularPrecioVenta({ costo: 100, margenMin: -5, redondeo: 100 }));
  assert.throws(() => calcularPrecioVenta({ costo: 100, margenMin: 30, redondeo: 0 }));
});

test("la regla más específica gana", () => {
  const reglas: ReglaPrecio[] = [
    { alcance: "global", margenMin: 30, redondeo: 100 },
    { alcance: "categoria", categoriaId: "c1", margenMin: 40, redondeo: 500 },
    { alcance: "producto", productoId: "p1", margenMin: 50, redondeo: 1000 },
  ];
  assert.equal(resolverRegla(reglas, { productoId: "p1", categoriaId: "c1" }).margenMin, 50);
  assert.equal(resolverRegla(reglas, { productoId: "p2", categoriaId: "c1" }).margenMin, 40);
  assert.equal(resolverRegla(reglas, { productoId: "p2", categoriaId: "c9" }).margenMin, 30);
  assert.deepEqual(resolverRegla([], {}), REGLA_POR_DEFECTO);
});
