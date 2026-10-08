// Exploración de SOLO LECTURA de la API de Venndelo.
//
//   npm run venndelo:explorar
//
// Requiere VENNDELO_REFRESH_TOKEN en .env.local.
//
// Qué hace: intercambia el refresh token por un token de acceso, y consulta
// check-auth, productos y ciudades. NO crea pedidos, guías ni recogidas (Venndelo no
// tiene ambiente de pruebas: cualquier escritura sería real).
//
// El refresh token ROTA: si Venndelo devuelve uno nuevo, se guarda de inmediato en
// .env.local. Ningún token se imprime nunca.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const BASE = process.env.VENNDELO_API_URL ?? "https://api.venndelo.com";
const ARCHIVO_ENV = ".env.local";
const ARCHIVO_RESPALDO = ".venndelo-refresh.pendiente";
const refreshActual = process.env.VENNDELO_REFRESH_TOKEN?.trim();

if (!refreshActual) {
  console.error("Falta VENNDELO_REFRESH_TOKEN en .env.local.");
  process.exit(1);
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function resumir(valor: Json, profundidad = 0, maxima = 3): Json {
  if (typeof valor === "string") return valor.length > 70 ? valor.slice(0, 70) + "…" : valor;
  if (Array.isArray(valor)) {
    return profundidad > maxima
      ? `[${valor.length} elementos]`
      : [...valor.slice(0, 1).map((v) => resumir(v, profundidad + 1, maxima)), ...(valor.length > 1 ? [`… (${valor.length} en total)`] : [])];
  }
  if (valor && typeof valor === "object") {
    if (profundidad > maxima) return "{…}";
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, resumir(v, profundidad + 1, maxima)]));
  }
  return valor;
}

/** Guarda el refresh token rotado ANTES de seguir: si se pierde, se pierde el acceso. */
function guardarRefreshRotado(nuevo: string) {
  try {
    const texto = readFileSync(ARCHIVO_ENV, "utf8");
    const salto = texto.includes("\r\n") ? "\r\n" : "\n";
    const linea = `VENNDELO_REFRESH_TOKEN=${nuevo}`;
    const actualizado = /^VENNDELO_REFRESH_TOKEN=.*$/m.test(texto)
      ? texto.replace(/^VENNDELO_REFRESH_TOKEN=.*$/m, linea)
      : texto.replace(/\s*$/, "") + salto + linea + salto;
    writeFileSync(ARCHIVO_ENV + ".tmp", actualizado);
    renameSync(ARCHIVO_ENV + ".tmp", ARCHIVO_ENV);
    console.log("ℹ El refresh token rotó y ya quedó guardado en .env.local (no se muestra).");
  } catch (e) {
    writeFileSync(ARCHIVO_RESPALDO, nuevo);
    console.error(
      `⚠ El refresh token rotó pero NO se pudo actualizar .env.local (${e instanceof Error ? e.message : e}).\n` +
        `  El nuevo token quedó en el archivo ${ARCHIVO_RESPALDO}. Cópialo a VENNDELO_REFRESH_TOKEN en .env.local y borra ese archivo.`,
    );
    process.exitCode = 1;
  }
}

async function obtenerAccessToken(): Promise<string> {
  const res = await fetch(`${BASE}/v1/admin/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshActual! }),
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(texto); } catch { /* respuesta no JSON */ }
  if (!res.ok || typeof json.access_token !== "string") {
    // Si el servidor devolvió un refresh nuevo pese al error, no se pierde.
    if (typeof json.refresh_token === "string") guardarRefreshRotado(json.refresh_token);
    const detalle = JSON.stringify(json.errors ?? json).slice(0, 300);
    throw new Error(`No se pudo obtener el token de acceso (HTTP ${res.status}): ${detalle}`);
  }
  if (typeof json.refresh_token === "string" && json.refresh_token !== refreshActual) {
    guardarRefreshRotado(json.refresh_token);
  }
  console.log(`✔ Token de acceso obtenido (vigencia ${json.expires_in} s).`);
  return json.access_token;
}

async function leer(access: string, ruta: string, maxima = 3) {
  const res = await fetch(BASE + ruta, {
    method: "GET",
    headers: { Authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await res.text();
  let json: Json;
  try { json = JSON.parse(texto); } catch { json = texto.slice(0, 300); }
  console.log(`\n=== GET ${ruta}  →  HTTP ${res.status}`);
  console.log(JSON.stringify(resumir(json, 0, maxima), null, 2));
}

async function main() {
  const access = await obtenerAccessToken();
  await leer(access, "/v1/admin/check-auth");
  await leer(access, "/v1/admin/products?page_size=5&supply_model=ANY");
  await leer(access, "/v1/admin/products?page_size=5&supply_model=DROPSHIP", 7);
  await leer(access, "/v1/admin/region/cities?page_size=3");
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});

// Evita avisos si el archivo de respaldo ya existía de una corrida anterior.
if (existsSync(ARCHIVO_RESPALDO)) {
  console.error(`⚠ Existe ${ARCHIVO_RESPALDO}: contiene un refresh token pendiente de pasar a .env.local.`);
}
