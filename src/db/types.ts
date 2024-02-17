import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

import type { CollaboratorRole, HighlightTypeEnum } from "./enums";

export type Account = {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};
export type Collaborator = {
  id: string;
  role: CollaboratorRole;
  documentId: string;
  userId: string;
};
export type Cordinate = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number | null;
  highlightedRectangleId: string | null;
  highlightedBoundingRectangleId: string | null;
};
export type Document = {
  url: string;
  id: string;
  title: string;
  ownerId: string;
  note: string | null;
  isVectorised: Generated<boolean>;
  createdAt: Generated<Timestamp>;
};
export type Feedback = {
  id: string;
  message: string;
  contact_email: string | null;
  type: string;
  createdAt: Generated<Timestamp>;
  userId: string | null;
};
export type Flashcard = {
  id: string;
  question: string;
  answer: string;
  documentId: string;
  createdAt: Generated<Timestamp>;
};
export type FlashcardAttempt = {
  id: string;
  flashcardId: string;
  userId: string;
  createdAt: Generated<Timestamp>;
  userResponse: string;
  correctResponse: string | null;
  incorrectResponse: string | null;
  moreInfo: string | null;
};
export type Highlight = {
  id: string;
  type: HighlightTypeEnum;
  documentId: string;
  createdAt: Generated<Timestamp>;
  pageNumber: number | null;
};
export type Message = {
  id: string;
  text: string;
  createdAt: Generated<Timestamp>;
  userId: string | null;
  documentId: string;
  isUserMessage: boolean;
};
export type User = {
  id: string;
  name: string;
  email: string | null;
  emailVerified: Timestamp | null;
  image: string | null;
  createdAt: Generated<Timestamp>;
};
export type DB = {
  Account: Account;
  Collaborator: Collaborator;
  Cordinate: Cordinate;
  Document: Document;
  Feedback: Feedback;
  Flashcard: Flashcard;
  FlashcardAttempt: FlashcardAttempt;
  Highlight: Highlight;
  Message: Message;
  User: User;
};
