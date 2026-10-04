/** One-on-one talks used and the last team meeting, both reset each season. */
export interface LockerRoomState {
  talkedIds: string[];
  lastMeetingWeek: number | null;
}

export const EMPTY_LOCKER_ROOM: LockerRoomState = { talkedIds: [], lastMeetingWeek: null };
