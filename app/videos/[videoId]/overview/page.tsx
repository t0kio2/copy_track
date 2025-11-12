"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTrack, getVideoByVideoId } from "@/app/lib/storage";
import type { Track, Video } from "@/app/lib/types";
import { thumbnailUrlFromId } from "@/app/lib/youtube";

export default function OverviewPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [track, setTrackState] = useState<Track | null>(null);

  useEffect(() => {
    if (!videoId) return;
    const v = getVideoByVideoId(String(videoId));
    setVideo(v ?? null);
    const t = getTrack(String(videoId));
    setTrackState(t);
  }, [videoId]);

  const blocks = track?.levels?.length ?? 0;
  const blockSizeSec = track?.blockSizeSec ?? 5;
  const coverageRate = useMemo(() => {
    if (!track || blocks === 0) return 0;
    const covered = track.levels.filter((x) => x > 0).length;
    return Math.round((covered / blocks) * 100);
  }, [track, blocks]);

  const proficiencyRate = useMemo(() => {
    if (!track || blocks === 0) return 0;
    const sum = track.levels.reduce((a, b) => a + b, 0);
    return Math.round((sum / (3 * blocks)) * 100);
  }, [track, blocks]);

  if (!video) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Link href="/" className="text-sm text-emerald-600 hover:underline">← 戻る</Link>
        <div className="mt-6 rounded-md border p-6">動画が見つかりませんでした。</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/videos/${video.videoId}`} className="text-sm text-emerald-600 hover:underline">← 編集に戻る</Link>
          <Link href="/" className="text-sm text-zinc-600 hover:underline">一覧へ</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-full md:w-1/3">
            <img
              src={video.thumbnailUrl || thumbnailUrlFromId(video.videoId)}
              alt={video.title}
              className="aspect-video w-full rounded-md border object-cover"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{video.title}</h1>
            <div className="mt-1 text-sm text-zinc-600">
              合計ブロック: {blocks}（{blockSizeSec}秒/ブロック）
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">完了率 {coverageRate}%</span>
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">習熟度 {proficiencyRate}%</span>
              <Legend />
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-medium">進捗確認</h2>
          {!track ? (
            <div className="rounded-md border p-6">トラック情報がありません。</div>
          ) : (
            <div className="rounded-md border bg-white p-2 shadow-sm">
              <div className="grid gap-[2px] sm:gap-[3px] md:gap-[4px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(12px, 1fr))" }}>
                {track.levels.map((lv, i) => (
                  <div
                    key={i}
                    title={`${formatDuration(i * blockSizeSec)} (Lv:${lv})`}
                    className="flex aspect-square w-full flex-col overflow-hidden rounded-[2px] border border-zinc-300"
                  >
                    <Seg filled={lv >= 3} />
                    <Seg filled={lv >= 2} />
                    <Seg filled={lv >= 1} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-500">横幅に合わせて自動で改行し、全ブロックを表示します。</p>
        </section>
      </main>
    </div>
  );
}

function squareClass(level: number) {
  switch (level) {
    case 0:
      return "rounded-sm border border-zinc-300 bg-white";
    case 1:
      return "rounded-sm border border-emerald-300 bg-emerald-200";
    case 2:
      return "rounded-sm border border-emerald-400 bg-emerald-400";
    case 3:
      return "rounded-sm border border-emerald-600 bg-emerald-600";
    default:
      return "rounded-sm border border-zinc-300 bg-white";
  }
}

function Seg({ filled }: { filled: boolean }) {
  return (
    <div
      className={
        "flex-1 border-t first:border-t-0 " +
        (filled ? "bg-emerald-500 border-emerald-600" : "bg-white border-zinc-300")
      }
    />
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-600">
      <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-zinc-300 bg-white"/>未</span>
      <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-200"/>低</span>
      <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-emerald-400 bg-emerald-400"/>中</span>
      <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-emerald-600 bg-emerald-600"/>高</span>
    </div>
  );
}

function formatDuration(sec?: number) {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60).toString();
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
