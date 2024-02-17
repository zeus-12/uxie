export const CollaboratorRole = {
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
  OWNER: "OWNER",
} as const;
export type CollaboratorRole =
  (typeof CollaboratorRole)[keyof typeof CollaboratorRole];
export const HighlightTypeEnum = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
} as const;
export type HighlightTypeEnum =
  (typeof HighlightTypeEnum)[keyof typeof HighlightTypeEnum];
