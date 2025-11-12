"use client";

import { STORAGE_KEYS, Track, TracksIndex, Video } from "./types";
import { extractYouTubeId, normalizeYouTubeUrl, thumbnailUrlFromId } from "./youtube";

function nowISO() {
  return new Date().toISOString();
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getVideos(): Video[] {
  return readJSON<Video[]>(STORAGE_KEYS.videos, []);
}

export function setVideos(videos: Video[]) {
  writeJSON(STORAGE_KEYS.videos, videos);
}

export function getTracksIndex(): TracksIndex {
  return readJSON<TracksIndex>(STORAGE_KEYS.tracks, {});
}

export function setTracksIndex(idx: TracksIndex) {
  writeJSON(STORAGE_KEYS.tracks, idx);
}

export function getVideoByVideoId(videoId: string): Video | undefined {
  return getVideos().find((v) => v.videoId === videoId);
}

export function getTrack(videoId: string): Track | null {
  const idx = getTracksIndex();
  return idx[videoId] ?? null;
}

export function setTrack(track: Track) {
  const idx = getTracksIndex();
  idx[track.videoId] = track;
  setTracksIndex(idx);
}

export function removeVideo(id: string) {
  const videos = getVideos();
  const target = videos.find((v) => v.id === id);
  if (!target) return;
  setVideos(videos.filter((v) => v.id !== id));
  // 併せてトラックも削除
  const idx = getTracksIndex();
  delete idx[target.videoId];
  setTracksIndex(idx);
}

export function updateVideo(id: string, patch: Partial<Pick<Video, "title" | "instrument" | "note" | "durationSec">>) {
  const videos = getVideos();
  const i = videos.findIndex((v) => v.id === id);
  if (i === -1) return;
  const prev = videos[i];
  const next: Video = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  videos[i] = next;
  setVideos(videos);

  // duration 変更時は Track を再サンプリング
  if (typeof patch.durationSec === "number" && patch.durationSec > 0) {
    const oldTrack = getTrack(prev.videoId);
    const blockSize = oldTrack?.blockSizeSec ?? 5;
    const levels = oldTrack
      ? resampleLevelsMax(oldTrack.levels, blockSize, blockSize, patch.durationSec)
      : Array.from({ length: Math.ceil(patch.durationSec / blockSize) }, () => 0);
    setTrack({ videoId: prev.videoId, blockSizeSec: blockSize, levels });
  }
}

export function addVideo(params: { url: string; title?: string; instrument?: string; durationSec?: number; blockSizeSec?: number }): Video {
  const url = normalizeYouTubeUrl(params.url);
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error("YouTube の URL ではないようです");

  const videos = getVideos();
  if (videos.some((v) => v.videoId === videoId)) {
    const exist = videos.find((v) => v.videoId === videoId)!;
    return exist; // 既存を返す
  }

  const createdAt = nowISO();
  const v: Video = {
    id: uuid(),
    provider: "youtube",
    videoId,
    url,
    title: params.title?.trim() || `YouTube ${videoId}`,
    durationSec: typeof params.durationSec === "number" ? Math.max(1, Math.floor(params.durationSec)) : 180,
    thumbnailUrl: thumbnailUrlFromId(videoId),
    instrument: params.instrument?.trim() || undefined,
    createdAt,
    updatedAt: createdAt,
  };
  const next = [...videos, v];
  setVideos(next);

  // Track 初期化
  const blockSizeSec = params.blockSizeSec && params.blockSizeSec > 0 ? Math.floor(params.blockSizeSec) : 5;
  const blocks = Math.ceil(v.durationSec / blockSizeSec);
  const track: Track = {
    videoId: v.videoId,
    blockSizeSec,
    levels: Array.from({ length: blocks }, () => 0),
  };
  setTrack(track);
  return v;
}

// --- ブロック変換ユーティリティ ---
export function resampleLevelsMax(oldLevels: number[], oldBlock: number, newBlock: number, totalSec?: number): number[] {
  if (oldLevels.length === 0 || oldBlock <= 0 || newBlock <= 0) return [];
  const duration = totalSec && totalSec > 0 ? totalSec : oldLevels.length * oldBlock;
  const newLen = Math.max(1, Math.ceil(duration / newBlock));
  const out = new Array<number>(newLen).fill(0);
  for (let j = 0; j < newLen; j++) {
    const start = j * newBlock;
    const end = Math.min(duration, start + newBlock);
    let maxLevel = 0;
    const iStart = Math.floor(start / oldBlock);
    const iEnd = Math.floor((Math.max(0, end - 0.000001)) / oldBlock);
    for (let i = iStart; i <= iEnd && i < oldLevels.length; i++) {
      maxLevel = Math.max(maxLevel, oldLevels[i] || 0);
      if (maxLevel === 3) break;
    }
    out[j] = maxLevel;
  }
  return out;
}

export function updateTrackBlockSize(videoId: string, newBlockSizeSec: number) {
  const track = getTrack(videoId);
  const video = getVideoByVideoId(videoId);
  if (!track || !video) return;
  const bs = Math.max(1, Math.floor(newBlockSizeSec));
  if (bs === track.blockSizeSec) return;
  const levels = resampleLevelsMax(track.levels, track.blockSizeSec, bs, video.durationSec);
  setTrack({ videoId, blockSizeSec: bs, levels });
}
