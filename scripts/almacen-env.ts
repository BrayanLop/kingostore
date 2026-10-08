// Almacén de un token rotativo en .env.local, para scripts de línea de comandos.
// En producción el token se guardará en una tabla segura de la base de datos.
import { readFileSync, renameSync, writeFileSync } from "node:fs";

export function crearAlmacenEnv(variable: string, archivo = ".env.local") {
  let actual = process.env[variable]?.trim() ?? "";
  return {
    async leer() {
      return actual;
    },
    async guardar(nuevo: string) {
      const respaldo = `.${variable.toLowerCase()}.pendiente`;
      try {
        const texto = readFileSync(archivo, "utf8");
        const salto = texto.includes("\r\n") ? "\r\n" : "\n";
        const linea = `${variable}=${nuevo}`;
        const patron = new RegExp(`^${variable}=.*$`, "m");
        const actualizado = patron.test(texto)
          ? texto.replace(patron, linea)
          : texto.replace(/\s*$/, "") + salto + linea + salto;
        writeFileSync(archivo + ".tmp", actualizado);
        renameSync(archivo + ".tmp", archivo);
        actual = nuevo;
        console.log(`ℹ ${variable} rotó y se guardó en ${archivo} (no se muestra).`);
      } catch (e) {
        // Si no se puede escribir el archivo, el token nuevo no se pierde.
        writeFileSync(respaldo, nuevo);
        actual = nuevo;
        console.error(
          `⚠ ${variable} rotó pero no se pudo actualizar ${archivo}. El nuevo valor quedó en ${respaldo}: ` +
            `cópialo a ${archivo} y borra ese archivo. (${e instanceof Error ? e.message : e})`,
        );
        process.exitCode = 1;
      }
    },
  };
}
