/**
 * Genera el ADMIN_PASSWORD_HASH (argon2id) para el login de VSL Studio.
 *
 *   node scripts/generar-hash-admin.mjs
 *
 * Pide la clave sin mostrarla en pantalla y sólo imprime el hash resultante.
 * La clave en texto plano nunca se escribe a disco ni queda en el historial.
 */
import argon2 from "argon2";
import { createInterface } from "node:readline";

function preguntarOculto(pregunta) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl.output;
    let silenciar = false;
    output.write(pregunta);
    // Interceptamos la escritura para que los caracteres tipeados no se vean.
    rl._writeToOutput = (texto) => {
      if (!silenciar) output.write(texto);
    };
    silenciar = true;
    rl.question("", (respuesta) => {
      silenciar = false;
      output.write("\n");
      rl.close();
      resolve(respuesta);
    });
  });
}

const clave = await preguntarOculto("Clave nueva: ");
if (clave.length < 12) {
  console.error("\nLa clave debe tener al menos 12 caracteres.");
  process.exit(1);
}
const confirmacion = await preguntarOculto("Repetila: ");
if (clave !== confirmacion) {
  console.error("\nNo coinciden.");
  process.exit(1);
}

const hash = await argon2.hash(clave, { type: argon2.argon2id });
console.log("\nADMIN_PASSWORD_HASH generado:\n");
console.log(hash);
console.log("\nCargalo en Vercel con:\n");
console.log("  npx vercel env rm ADMIN_PASSWORD_HASH production --yes");
console.log("  npx vercel env add ADMIN_PASSWORD_HASH production");
console.log("\n(pegá el hash cuando lo pida, y después redeployá para que tome efecto)");
