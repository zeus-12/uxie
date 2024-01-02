import {
  alertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import { highlightBlock } from "@/components/Editor/CustomBlocks/Highlight";
import { getBlockSchemaFromSpecs, defaultBlockSpecs } from "@blocknote/core";
import {
  defaultBlockTypeDropdownItems,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { AlertCircle } from "lucide-react";

export const blockTypeDropdownItems = [
  ...defaultBlockTypeDropdownItems,
  {
    name: "Alert",
    type: "alert",
    icon: AlertCircle,
  },
];

export const blockSpecs = {
  ...defaultBlockSpecs,
  alert: alertBlock,
  highlight: highlightBlock,
};

export const blockSchema = getBlockSchemaFromSpecs(blockSpecs);

export const slashMenuItems = [
  ...getDefaultReactSlashMenuItems(blockSchema),
  insertAlert,
];
