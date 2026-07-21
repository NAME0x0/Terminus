export function parseOsc7Cwd(data: string): string | null {
  if (!data.startsWith('file://')) {
    return null;
  }

  try {
    const url = new URL(data);
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(path)) {
      path = path.slice(1);
    }
    return path || null;
  } catch {
    return null;
  }
}
