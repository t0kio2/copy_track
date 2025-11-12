export function extractYouTubeId(input: string): string | null {
  try {
    const s = input.trim();
    // Already an ID-like (11 chars typical). Keep permissive fallback.
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

    const url = new URL(s);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
      // youtu.be/<id>
      if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0];
        return id || null;
      }
      // /watch?v=<id>
      const v = url.searchParams.get("v");
      if (v) return v;
      // /embed/<id>
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      // /shorts/<id>
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }
  } catch {
    // ignore
  }
  return null;
}

export function thumbnailUrlFromId(id: string, quality: "hq" | "mq" | "max" = "hq"): string {
  const map = {
    hq: "hqdefault.jpg",
    mq: "mqdefault.jpg",
    max: "maxresdefault.jpg",
  } as const;
  return `https://img.youtube.com/vi/${id}/${map[quality]}`;
}

export function normalizeYouTubeUrl(input: string): string {
  const id = extractYouTubeId(input);
  if (!id) return input.trim();
  return `https://www.youtube.com/watch?v=${id}`;
}

