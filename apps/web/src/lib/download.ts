export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename.replace(/[/\\?%*:|"<>]/g, '-') });
  link.click();
  URL.revokeObjectURL(url);
}
