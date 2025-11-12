"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Video } from "./lib/types";
import { addVideo, getTrack, getVideos, removeVideo } from "./lib/storage";
import { thumbnailUrlFromId } from "./lib/youtube";
import { getYouTubeDurationSeconds } from "./lib/yt-iframe";
import { fetchYouTubeTitle } from "./lib/yt-oembed";

export default function Home() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setVideos(getVideos());
  }, []);

  const handleAdded = (v: Video | null) => {
    setOpen(false);
    if (v) {
      setVideos(getVideos());
      router.push(`/videos/${v.videoId}`);
    }
  };

  const onDelete = (id: string) => {
    if (!confirm("この動画を削除しますか？")) return;
    removeVideo(id);
    setVideos(getVideos());
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold">CopyTrack</h1>
        <p className="text-sm text-zinc-600">YouTube のタブ譜動画で練習進捗を記録</p>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">登録済み</h2>
          <button
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
            onClick={() => setOpen(true)}
          >
            ＋ 追加
          </button>
        </div>

        {videos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-zinc-600">
            まず「＋ 追加」から YouTube URL を登録してください
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <article key={v.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <Link href={`/videos/${v.videoId}`}>
                  {/* use img for remote thumbnail to avoid Next/Image config */}
                  <img
                    src={v.thumbnailUrl || thumbnailUrlFromId(v.videoId)}
                    alt={v.title}
                    className="aspect-video w-full object-cover"
                  />
                </Link>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/videos/${v.videoId}`} className="font-medium hover:underline">
                        {v.title || v.videoId}
                      </Link>
                      <div className="text-xs text-zinc-500">{formatDuration(v.durationSec)} / {v.provider}</div>
                    </div>
                    <button
                      className="rounded-md border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                      onClick={() => onDelete(v.id)}
                    >
                      削除
                    </button>
                  </div>
                  {/* 進捗ゲージ（完了/習熟） */}
                  <CardMetrics videoId={v.videoId} />
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {open && <AddDialog onClose={() => setOpen(false)} onAdded={handleAdded} />}
    </div>
  );
}

function formatDuration(sec?: number) {
  if (!sec || sec < 0) return "--:--";
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(1, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function AddDialog({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (v: Video | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [autoTitleLoading, setAutoTitleLoading] = useState(false);
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [duration, setDuration] = useState<number | "">(180);
  const [gettingDur, setGettingDur] = useState(false);
  const [userEditedDuration, setUserEditedDuration] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = useMemo(() => url.trim().length > 0, [url]);

  const submit = async () => {
    if (!valid) return;
    try {
      setSaving(true);
      const v = addVideo({ url, title: title.trim(), instrument: instrument.trim(), durationSec: typeof duration === "number" ? duration : undefined });
      onAdded(v);
    } catch (e: any) {
      alert(e?.message || "登録に失敗しました");
      onAdded(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h3 className="mb-3 text-lg font-medium">動画を追加</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm">YouTube URL</span>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">タイトル（任意）</span>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="例: Sample Guitar Tab"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setUserEditedTitle(true);
              }}
            />
            {autoTitleLoading && (
              <span className="mt-1 block text-xs text-zinc-500">タイトルを自動取得中…</span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">楽器（任意）</span>
            <input
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Guitar / Bass / Drums"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">動画長（秒・任意）</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value === "" ? "" : Number(e.target.value));
                  setUserEditedDuration(true);
                }}
              />
              <button
                type="button"
                className="whitespace-nowrap rounded-md border px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                onClick={async () => {
                  try {
                    setGettingDur(true);
                    const sec = await getYouTubeDurationSeconds(url);
                    setDuration(sec);
                  } catch (e: any) {
                    alert(e?.message || "動画長の自動取得に失敗しました");
                  } finally {
                    setGettingDur(false);
                  }
                }}
                disabled={!valid || gettingDur}
              >
                {gettingDur ? "取得中..." : "自動取得"}
              </button>
            </div>
          </label>
        </div>
        {/* URL 入力時のタイトル自動取得 */}
        <AutoTitleFetcher url={url} onTitle={(t) => {
          if (!userEditedTitle && t) setTitle(t);
        }} onLoading={setAutoTitleLoading} />
        <AutoDurationFetcher url={url} onDuration={(sec) => {
          if (!userEditedDuration && typeof sec === "number" && sec > 0) setDuration(sec);
        }} onLoading={setGettingDur} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={onClose} disabled={saving}>
            キャンセル
          </button>
          <button
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-white disabled:opacity-60"
            onClick={submit}
            disabled={!valid || saving}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoTitleFetcher({ url, onTitle, onLoading }: { url: string; onTitle: (t: string) => void; onLoading: (b: boolean) => void }) {
  const [lastUrl, setLastUrl] = useState<string>("");
  useEffect(() => {
    if (!url || url === lastUrl) return;
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        onLoading(true);
        const t = await fetchYouTubeTitle(url, controller.signal);
        onTitle(t);
        setLastUrl(url);
      } catch {
        // ignore
      } finally {
        onLoading(false);
      }
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [url]);
  return null;
}

function AutoDurationFetcher({ url, onDuration, onLoading }: { url: string; onDuration: (sec: number) => void; onLoading: (b: boolean) => void }) {
  const [lastUrl, setLastUrl] = useState<string>("");
  useEffect(() => {
    if (!url || url === lastUrl) return;
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        onLoading(true);
        const sec = await getYouTubeDurationSeconds(url);
        if (typeof sec === "number" && sec > 0) {
          onDuration(sec);
          setLastUrl(url);
        }
      } catch {
        // ignore (手動入力/手動取得ボタンを利用可能)
      } finally {
        onLoading(false);
      }
    }, 700);
    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [url]);
  return null;
}
function CardMetrics({ videoId }: { videoId: string }) {
  const track = getTrack(videoId);
  if (!track || !track.levels?.length) return null;
  const blocks = track.levels.length;
  const covered = track.levels.filter((x) => x > 0).length;
  const coverageRate = Math.round((covered / blocks) * 100);
  const sum = track.levels.reduce((a, b) => a + b, 0);
  const proficiencyRate = Math.round((sum / (3 * blocks)) * 100);
  return (
    <div className="mt-2 space-y-1">
      <Gauge label="完了" percent={coverageRate} color="emerald" />
      <Gauge label="習熟" percent={proficiencyRate} color="emerald" subtle />
    </div>
  );
}
function Gauge({ label, percent, color = "emerald", subtle = false }: { label: string; percent: number; color?: "emerald"; subtle?: boolean }) {
  const clamp = Math.max(0, Math.min(100, percent));
  const bar = subtle ? `bg-${color}-200` : `bg-${color}-500`;
  // Tailwind v4 での動的クラス簡易対応: フォールバック色を指定
  const barClass = subtle ? "bg-emerald-200" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[11px] text-zinc-600">{label}</span>
      <div className="relative h-2 w-full rounded bg-zinc-200">
        <div className={`h-2 rounded ${bar} ${barClass}`} style={{ width: `${clamp}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] text-zinc-600">{clamp}%</span>
    </div>
  );
}
