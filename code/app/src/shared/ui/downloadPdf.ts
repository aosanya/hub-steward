const unsafe = /[\\/:*?"<>|]/g;

export function downloadPdf(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(unsafe, " ").trim() || "report"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
