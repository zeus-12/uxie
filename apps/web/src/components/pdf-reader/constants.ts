// Single definition lives in shared — two copies of an enum are two distinct
// types, and the reader hook (shared) hands its status straight to this app's
// toolbar.
export {
  READING_MODE,
  READING_SPEEDS,
  READING_STATUS,
} from "@uxie/shared/components/pdf-reader/constants";
