export type SegmentType = "work" | "break";

export type ActiveSegment = {
  type: SegmentType;
  startedAt: string;
};

export type WorkRecord = {
  id: string;
  type: SegmentType;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  source: "guest" | "account";
};

export type RecordPayload = Omit<WorkRecord, "source">;

export type SessionUser = {
  id: string;
  name: string;
  username: string;
};
