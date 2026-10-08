import assert from "node:assert/strict";
import { test } from "node:test";
import { AdaptadorCsv, ErrorCsv, parsearCsv, productosDesdeCsv } from "./csv";

const ENCABEZADO = "id_externo,nombre,descripcion,imagenes,variante_id,atributos,costo,stock";

test("agrupa filas del mismo producto como variantes", () => {
  const csv = [
    ENCABEZADO,
    "A1,Camiseta,Algodón,http://x/1.jpg|http://x/2.jpg,A1-S,Talla:S;Color:Rojo,20000,5",
    "A1,Camiseta,Algodón,,A1-M,Talla:M;Color:Rojo,20000,8",
    "B2,Taza,,,,,8000,10",
  ].join("\n");
  const r = productosDesdeCsv(csv);
  assert.equal(r.length, 2);
  assert.equal(r[0].variantes.length, 2);
  assert.deepEqual(r[0].imagenes, ["http://x/1.jpg", "http://x/2.jpg"]);
  assert.deepEqual(r[0].variantes[0].atributos, { Talla: "S", Color: "Rojo" });
  assert.equal(r[1].variantes[0].idExterno, "B2", "sin variante_id usa id_externo");
});

test("acepta punto y coma (Excel en español), BOM, CRLF y comillas con comas", () => {
  const csv = "﻿id_externo;nombre;costo;stock\r\nZ9;\"Taza, grande\";12000;3\r\n";
  const r = productosDesdeCsv(csv);
  assert.equal(r[0].nombre, "Taza, grande");
  assert.equal(r[0].variantes[0].costo, 12000);
});

test("comillas escapadas y saltos de línea dentro de una celda", () => {
  const filas = parsearCsv('a,b\n"dice ""hola""","línea1\nlínea2"\n');
  assert.deepEqual(filas[1], ['dice "hola"', "línea1\nlínea2"]);
});

test("errores claros con número de línea", () => {
  const encabezado = "id_externo,nombre,costo,stock";
  assert.throws(() => productosDesdeCsv(`${encabezado}\nA,Algo,12.900,3`), (e) =>
    e instanceof ErrorCsv && e.linea === 2 && /costo/.test(e.message));
  assert.throws(() => productosDesdeCsv(`${encabezado}\nA,Algo,100,-1`), /stock/);
  assert.throws(() => productosDesdeCsv(`${encabezado}\n,Algo,100,1`), /id_externo/);
  assert.throws(() => productosDesdeCsv("id_externo,nombre\nA,Algo"), /costo/);
  assert.throws(() => productosDesdeCsv(encabezado), /no tiene datos/);
  assert.throws(
    () => productosDesdeCsv(`${encabezado}\nA,Algo,100,1\nA,Algo,100,2`),
    /repetida/,
  );
  assert.throws(
    () => productosDesdeCsv("id_externo,nombre,costo,stock,atributos\nA,Algo,100,1,Rojo"),
    /atributo inválido/,
  );
});

test("el adaptador entrega todo en una sola página y no crea pedidos", async () => {
  const a = new AdaptadorCsv("csv", "id_externo,nombre,costo,stock\nA,Algo,100,4");
  const p = await a.listarProductos();
  assert.equal(p.hayMas, false);
  assert.equal(await a.obtenerStock("A"), 4);
  assert.equal(await a.obtenerStock("no-existe"), 0);
  await assert.rejects(() => a.crearPedido(), /manualmente/);
});
