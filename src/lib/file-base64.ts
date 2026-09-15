/** Converte um ficheiro escolhido no browser para base64, para envio ao servidor. */
export async function fileToBase64(file: File): Promise<{ name: string; contentType: string; base64: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { name: file.name, contentType: file.type || "application/octet-stream", base64: btoa(binary) };
}
