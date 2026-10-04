import type { PlayingTimePromise } from '@sports-management-sim/sport-lacrosse';

/** One-on-one talks used, open promises and the last team meeting, all reset each season. */
export interface LockerRoomState {
  talkedIds: string[];
  lastMeetingWeek: number | null;
  /** Playing-time promises still to be judged. Missing in older saves. */
  promises?: PlayingTimePromise[];
}

export const EMPTY_LOCKER_ROOM: LockerRoomState = { talkedIds: [], lastMeetingWeek: null, promises: [] };
