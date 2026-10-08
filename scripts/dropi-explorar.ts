// Exploración de SOLO LECTURA de la API de Dropi, para conocer la forma real de los
// datos antes de escribir el adaptador. No crea pedidos ni modifica nada.
//
//   npm run dropi:explorar
//
// Requiere DROPI_TOKEN en .env.local (el token que genera Dropi en "Mis tiendas").
// El token NUNCA se imprime.

const BASE = process.env.DROPI_API_URL ?? "https://api.dropi.co/integrations/";
const TOKEN = process.env.DROPI_TOKEN;

if (!TOKEN) {
  console.error("Falta DROPI_TOKEN en .env.local.");
  process.exit(1);
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Resume la forma de un valor: tipos y primeros valores, sin volcar todo. */
function resumir(valor: Json, profundidad = 0): Json {
  if (typeof valor === "string") return valor.length > 70 ? valor.slice(0, 70) + "…" : valor;
  if (Array.isArray(valor)) {
    return profundidad > 3 ? `[${valor.length} elementos]` : [...valor.slice(0, 1).map((v) => resumir(v, profundidad + 1)), ...(valor.length > 1 ? [`… (${valor.length} en total)`] : [])];
  }
  if (valor && typeof valor === "object") {
    if (profundidad > 3) return "{…}";
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, resumir(v, profundidad + 1)]));
  }
  return valor;
}

async function llamar(metodo: "GET" | "POST", ruta: string, cuerpo?: unknown) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json;charset=UTF-8", "dropi-integration-key": TOKEN! },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await res.text();
  let json: Json;
  try { json = JSON.parse(texto); } catch { json = texto.slice(0, 300); }
  console.log(`\n=== ${metodo} ${ruta}  →  HTTP ${res.status}`);
  console.log(JSON.stringify(resumir(json), null, 2));
  return json as { isSuccess?: boolean; objects?: Json };
}

async function main() {
  await llamar("POST", "products/index", {
    startData: 0, pageSize: 2, order_type: "desc", order_by: "id",
    keywords: "", active: true, no_count: true, integration: true, get_stock: false,
  });
  await llamar("GET", "categories/");
  await llamar("GET", "warehouses/");
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
