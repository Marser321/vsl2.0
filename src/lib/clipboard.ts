export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator?.clipboard
) {
  if (!clipboard) throw new Error("El portapapeles no está disponible");
  await clipboard.writeText(text);
}
