"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTrack, getVideoByVideoId, setTrack, updateVideo, updateTrackBlockSize } from "@/app/lib/storage";
import type { Track, Video } from "@/app/lib/types";
import { thumbnailUrlFromId } from "@/app/lib/youtube";

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const router = useRouter();
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
  const totalSeconds = blocks * blockSizeSec;
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

  const practicedSeconds = useMemo(() => {
    if (!track) return 0;
    const count = track.levels.filter((x) => x > 0).length;
    return count * blockSizeSec;
  }, [track, blockSizeSec]);

  const setLevel = (index: number, level: number) => {
    if (!track) return;
    const next = { ...track, levels: track.levels.slice() };
    next.levels[index] = level;
    setTrackState(next);
    setTrack(next);
  };

  const toggle = (index: number) => {
    if (!track) return;
    const current = track.levels[index] ?? 0;
    const next = (current + 1) % 4; // 0->1->2->3->0
    setLevel(index, next);
  };

  // 時間カーソル（縦バー）
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [cursorSec, setCursorSec] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // 端でのオートスクロール
  const velRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastClientXRef = useRef<number>(0);

  const stopAutoScroll = () => {
    velRef.current = 0;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tickAutoScroll = (clientX: number) => {
    const sc = scrollRef.current;
    if (!sc) return;
    const rect = sc.getBoundingClientRect();
    const threshold = 32; // px
    let v = 0;
    if (clientX - rect.left < threshold && sc.scrollLeft > 0) {
      v = -Math.min(12, Math.floor((threshold - (clientX - rect.left)) / 2) + 4);
    } else if (rect.right - clientX < threshold && sc.scrollLeft < sc.scrollWidth - sc.clientWidth) {
      v = Math.min(12, Math.floor((threshold - (rect.right - clientX)) / 2) + 4);
    }
    velRef.current = v;
    if (rafRef.current == null && v !== 0) {
      const loop = () => {
        const sc2 = scrollRef.current;
        if (!sc2) return;
        if (velRef.current !== 0) {
          sc2.scrollLeft += velRef.current;
          // スクロールに合わせてカーソルの時刻を更新
          updateCursor(lastClientXRef.current);
          rafRef.current = requestAnimationFrame(loop);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  const updateCursor = (clientX: number) => {
    const el = contentRef.current;
    if (!el || totalSeconds <= 0) return;
    const rect = el.getBoundingClientRect();
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));

    // デフォルト: 全体比から推定
    const ratio = rect.width > 0 ? x / rect.width : 0;
    let sec = Math.round(ratio * totalSeconds);

    // 改良: 実際に重なっているブロックから厳密に算出
    const cols = Array.from(el.querySelectorAll<HTMLDivElement>("[data-col]"));
    for (const col of cols) {
      const cr = col.getBoundingClientRect();
      if (clientX >= cr.left && clientX <= cr.right) {
        const idx = Number(col.dataset.col || 0) || 0;
        const within = cr.width > 0 ? (clientX - cr.left) / cr.width : 0;
        const local = Math.round(within * blockSizeSec);
        sec = Math.min(totalSeconds, idx * blockSizeSec + local);
        break;
      }
    }

    setCursorX(x);
    setCursorSec(sec);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // マウスはホバーで十分。タッチ時のみドラッグ状態にする。
    if (e.pointerType === "touch") setDragging(true);
    lastClientXRef.current = e.clientX;
    updateCursor(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    lastClientXRef.current = e.clientX;
    if (!dragging) {
      // ホバーでも追従
      updateCursor(e.clientX);
      tickAutoScroll(e.clientX);
      return;
    }
    updateCursor(e.clientX);
    tickAutoScroll(e.clientX);
  };
  const onPointerUp = () => {
    setDragging(false);
    stopAutoScroll();
  };
  const onPointerLeave = () => {
    if (!dragging) {
      setCursorX(null);
      setCursorSec(null);
    }
    stopAutoScroll();
  };

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
          <Link href="/" className="text-sm text-emerald-600 hover:underline">← 戻る</Link>
          <Link href={`/videos/${video.videoId}/overview`} className="text-sm text-zinc-600 hover:underline">進捗確認</Link>
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
              {formatDuration(video.durationSec)} ・ {video.instrument || "Instrument"}
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">完了率 {coverageRate}%</span>
              <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">習熟度 {proficiencyRate}%</span>
              <span className="rounded bg-zinc-100 px-2 py-1 text-zinc-700">推定練習 {Math.round(practicedSeconds / 60)} 分</span>
              <a href={video.url} target="_blank" className="text-emerald-700 hover:underline" rel="noreferrer">
                動画を開く ↗
              </a>
              <button className="rounded-md border px-2 py-1 text-zinc-700 hover:bg-zinc-50" onClick={() => setEditOpen(true)}>編集</button>
            </div>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-medium">練習タイムライン（5秒ブロック）</h2>
          {!track ? (
            <div className="rounded-md border p-6">トラック情報がありません。</div>
          ) : (
            <div ref={scrollRef} className="overflow-x-auto rounded-md border bg-white p-3 pt-5 shadow-sm">
              <div className="relative inline-flex items-end gap-2 select-none">
                {/* 縦方向ラベル（上=高, 中=中, 下=低） */}
                <div className="mr-1 flex flex-col items-center gap-1 text-[10px] text-zinc-500">
                  <span className="h-6 leading-6">高</span>
                  <span className="h-6 leading-6">中</span>
                  <span className="h-6 leading-6">低</span>
                </div>

                {/* ブロック本体 */}
                <div
                  ref={contentRef}
                  className="relative inline-flex items-end gap-1"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerLeave}
                >
                {track.levels.map((level, idx) => (
                  <div
                    key={idx}
                    data-col={idx}
                    className="flex cursor-pointer flex-col items-stretch gap-1"
                    onClick={() => {
                      if (!dragging) toggle(idx);
                    }}
                  >
                      {/* 上=3, 中=2, 下=1 の順に表示 */}
                      <Cell filled={level >= 3} />
                      <Cell filled={level >= 2} />
                      <Cell filled={level >= 1} />
                      <div className="text-center text-[10px] text-zinc-500">{(idx * blockSizeSec).toString()}</div>
                    </div>
                  ))}

                  {cursorX !== null && (
                    <>
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 w-px bg-emerald-600"
                        style={{ left: `${cursorX}px` }}
                      />
                      <div
                        className="pointer-events-none absolute -top-5 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                        style={{ left: `${cursorX}px` }}
                      >
                        {formatDuration(cursorSec ?? 0)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-500">上=高レベル、下=低レベル。クリックで 0→1→2→3→0 と変化（長押しで 0 クリアは今後対応）。</p>
        </section>
      </main>
      {editOpen && track && (
        <EditDialog
          video={video}
          trackBlockSize={track.blockSizeSec}
          onClose={() => setEditOpen(false)}
          onSaved={(patch) => {
            if (typeof patch.durationSec === "number") {
              updateVideo(video.id, { durationSec: patch.durationSec, title: patch.title, instrument: patch.instrument, note: patch.note });
            } else {
              updateVideo(video.id, { title: patch.title, instrument: patch.instrument, note: patch.note });
            }
            if (typeof patch.blockSizeSec === "number") {
              updateTrackBlockSize(video.videoId, patch.blockSizeSec);
            }
            // 再読込
            const v = getVideoByVideoId(video.videoId);
            if (v) setVideo({ ...v });
            const t = getTrack(video.videoId);
            if (t) setTrackState(t);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Cell({ filled, label }: { filled: boolean; label?: string }) {
  return (
    <div
      title={label}
      className={
        "h-6 w-6 rounded-sm border " +
        (filled ? "bg-emerald-500 border-emerald-600" : "bg-white border-zinc-300")
      }
    />
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

function EditDialog({ video, trackBlockSize, onClose, onSaved }: { video: Video; trackBlockSize: number; onClose: () => void; onSaved: (patch: { title?: string; instrument?: string; note?: string; durationSec?: number; blockSizeSec?: number }) => void }) {
  const [title, setTitle] = useState(video.title);
  const [instrument, setInstrument] = useState(video.instrument || "");
  const [note, setNote] = useState(video.note || "");
  const [duration, setDuration] = useState<number | "">(video.durationSec ?? "");
  const [blockSize, setBlockSize] = useState<number>(trackBlockSize || 5);
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
        <h3 className="mb-3 text-lg font-medium">動画情報を編集</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm">タイトル</span>
            <input className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">楽器</span>
            <input className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={instrument} onChange={(e) => setInstrument(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">メモ</span>
            <textarea className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">動画長（秒）</span>
            <input type="number" min={1} className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={duration} onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">ブロック間隔（秒）</span>
            <select className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={blockSize} onChange={(e) => setBlockSize(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span className="mt-1 block text-xs text-zinc-500">変更時は既存の進捗を「最大値」で変換します。</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100" onClick={onClose} disabled={saving}>キャンセル</button>
          <button
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-white disabled:opacity-60"
            onClick={async () => {
              try {
                setSaving(true);
                onSaved({
                  title: title.trim() || undefined,
                  instrument: instrument.trim() || undefined,
                  note: note.trim() || undefined,
                  durationSec: typeof duration === "number" ? Math.max(1, Math.floor(duration)) : undefined,
                  blockSizeSec: blockSize,
                });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
