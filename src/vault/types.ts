export type EntrySummary = {
  title: string;
  username: string;
  url: string;
  createdAt: number;
  updatedAt: number;
};

export type EntrySecret = {
  password: string;
  notes: string;
};

export type Entry = EntrySummary & EntrySecret & { id: string };

/** What's actually on disk: an id and two opaque blobs. No titles, no timestamps, nothing. */
export type EncryptedRow = { id: string; summary: Uint8Array; secret: Uint8Array };
