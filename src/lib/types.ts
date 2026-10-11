export type Priority = "high" | "med" | "low";

export type Person = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  role: string;
  /** Linked login username, if this person has an app account. */
  username?: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type Checklist = {
  id: string;
  title: string;
  items: ChecklistItem[];
  position: number;
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author?: string;
};

export type Activity = {
  id: string;
  at: string;
  by: string;
  text: string;
};

export type Card = {
  id: string;
  listId: string;
  boardId: string;
  title: string;
  notes: string;
  priority: Priority;
  dueDate: string | null;
  startDate: string | null;
  coverColor: string | null;
  position: number;
  archived: boolean;
  followerId: string | null;
  memberIds: string[];
  labelIds: string[];
  progress: number;
  createdAt: string;
  checklists: Checklist[];
  comments: Comment[];
  activities: Activity[];
  /** Card IDs this card is blocked by (must finish first). */
  dependsOnIds: string[];
  /** ISO date when card entered current list (for SLA / dwell time). */
  enteredListAt: string | null;
};

export type List = {
  id: string;
  boardId: string;
  title: string;
  position: number;
  cards: Card[];
};

export type BoardSummary = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  cardCount: number;
};

export type Board = {
  id: string;
  title: string;
  description: string;
  lists: List[];
  people: Person[];
  labels: Label[];
};

export type ThemeId =
  | "light"
  | "snow"
  | "sand"
  | "glass"
  | "dark"
  | "ink"
  | "midnight"
  | "forest"
  | "mica"
  | "acrylic";

export type AccentId = "blue" | "teal" | "sky" | "forest" | "slate" | "graphite";

export type FontId = "vazirmatn" | "estedad" | "noto" | "plex" | "readex" | "rubik";

export type ColorScheme = "light" | "dark";

export type UserPrefs = {
  theme: ThemeId;
  accent: AccentId;
  font: FontId;
};
