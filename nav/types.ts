/**
 * Bespoke navigation state (decision 3). The root holds exactly these two:
 * which primary tab is showing, and which modal sheet (if any) is open. No
 * router library — screens read these and call setters.
 */
export type Tab = 'calendar' | 'summary';

export type Sheet = 'entry' | 'settings' | null;
