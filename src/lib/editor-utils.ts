import {
  createAlertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import { createHighlightBlock } from "@/components/Editor/CustomBlocks/Highlight";
import { Block, BlockSpec, PropSchema } from "@blocknote/core";
import {
  defaultBlockTypeDropdownItems,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { AlertCircle } from "lucide-react";
import { defaultBlockSchema } from "@blocknote/core";

export const blockTypeDropdownItems = [
  ...defaultBlockTypeDropdownItems,
  {
    name: "Alert",
    type: "alert",
    icon: AlertCircle as any,
    isSelected: (
      block: Block<Record<string, BlockSpec<string, PropSchema, boolean>>>,
    ) => block.type === "alert",
  },
];

export const schemaWithCustomBlocks = {
  ...defaultBlockSchema,
  alert: createAlertBlock(),
  highlight: createHighlightBlock(),
};

export const slashMenuItems = [
  ...getDefaultReactSlashMenuItems(schemaWithCustomBlocks),
  insertAlert,
];
