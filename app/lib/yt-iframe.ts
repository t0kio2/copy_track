"use client";

import { extractYouTubeId } from "./youtube";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function ensureScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("window unavailable"));
    if (window.YT && window.YT.Player) return resolve();
    const existing = document.querySelector<HTMLScriptElement>("script[src^='https://www.youtube.com/iframe_api']");
    if (existing) {
      // 既に挿入済み。onYouTubeIframeAPIReady を待つ
      const ready = () => resolve();
      if (window.YT && window.YT.Player) return resolve();
      window.onYouTubeIframeAPIReady = ready;
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    window.onYouTubeIframeAPIReady = () => resolve();
    tag.onerror = () => reject(new Error("Failed to load YouTube IFrame API"));
    document.head.appendChild(tag);
  });
}

export async function getYouTubeDurationSeconds(input: string): Promise<number> {
  const id = extractYouTubeId(input);
  if (!id) throw new Error("YouTube の URL/ID を認識できませんでした");
  await ensureScript();
  const container = document.createElement("div");
  const elemId = `yt-temp-${id}-${Math.random().toString(36).slice(2, 8)}`;
  container.id = elemId;
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  document.body.appendChild(container);

  return new Promise<number>((resolve, reject) => {
    let destroyed = false;
    const cleanup = () => {
      if (destroyed) return;
      destroyed = true;
      try {
        container.remove();
      } catch {}
    };

    // eslint-disable-next-line new-cap
    const player = new window.YT.Player(elemId, {
      videoId: id,
      events: {
        onReady: () => {
          const start = Date.now();
          const timer = setInterval(() => {
            try {
              const dur = Math.round(player.getDuration?.() || 0);
              const elapsed = Date.now() - start;
              if (dur > 0) {
                clearInterval(timer);
                try { player.destroy?.(); } catch {}
                cleanup();
                resolve(dur);
              } else if (elapsed > 5000) {
                clearInterval(timer);
                try { player.destroy?.(); } catch {}
                cleanup();
                reject(new Error("動画長を取得できませんでした"));
              }
            } catch {
              clearInterval(timer);
              try { player.destroy?.(); } catch {}
              cleanup();
              reject(new Error("動画長取得中にエラーが発生しました"));
            }
          }, 200);
        },
        onError: () => {
          try { player.destroy?.(); } catch {}
          cleanup();
          reject(new Error("動画の読み込みに失敗しました"));
        },
      },
      playerVars: {
        controls: 0,
        modestbranding: 1,
        disablekb: 1,
      },
    });
  });
}

