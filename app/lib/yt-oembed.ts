"use client";

import { extractYouTubeId, normalizeYouTubeUrl } from "./youtube";

export async function fetchYouTubeTitle(input: string, signal?: AbortSignal): Promise<string> {
  const id = extractYouTubeId(input);
  if (!id) throw new Error("YouTube の URL/ID を認識できませんでした");
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    normalizeYouTubeUrl(id)
  )}&format=json`;
  const res = await fetch(url, { signal, credentials: "omit", cache: "no-store" });
  if (!res.ok) throw new Error("タイトルの取得に失敗しました");
  const json = await res.json();
  return String(json?.title || "");
}

