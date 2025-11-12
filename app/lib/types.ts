export type Video = {
  id: string; // uuid
  provider: "youtube";
  videoId: string; // YouTube の ID
  url: string; // 正規化済み URL
  title: string;
  durationSec: number; // 総秒数
  thumbnailUrl: string;
  instrument?: string;
  note?: string;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
};

export type Track = {
  videoId: string;
  blockSizeSec: number; // 可変（例: 1/2/5/10）
  levels: number[]; // 0..3
};

export type TracksIndex = Record<string, Track>;

export const STORAGE_KEYS = {
  videos: "copytrack.videos",
  tracks: "copytrack.tracks",
} as const;
