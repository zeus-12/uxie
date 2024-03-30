import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockNoteEditorType } from "@/types/editor";
import { defaultProps, insertOrUpdateBlock } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { AlertCircle, Ban, Check, Info, ShieldAlertIcon } from "lucide-react";
import { createElement } from "react";

const alertTypes = {
  warning: {
    icon: ShieldAlertIcon,
    color: "#e69819",
    backgroundColor: "#fff6e6",
  },
  error: {
    icon: Ban,
    color: "#d80d0d",
    backgroundColor: "#ffe6e6",
  },
  info: {
    icon: Info,
    color: "#507aff",
    backgroundColor: "#e6ebff",
  },
  success: {
    icon: Check,
    color: "#0bc10b",
    backgroundColor: "#e6ffe6",
  },
} as const;

type AlertTypeKeys = keyof typeof alertTypes;

export const AlertBlock = createReactBlockSpec(
  {
    type: "alert",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      type: {
        default: "warning" as const,
        values: ["warning", "error", "info", "success"] as const,
      },
    },
    content: "inline",
  },
  {
    render: (props) => (
      <div
        className="flex flex-1 items-center gap-2 break-words rounded-sm p-1"
        style={{
          backgroundColor: alertTypes[props.block.props.type].backgroundColor,
        }}
      >
        <Select
          onValueChange={(value) => {
            props.editor.updateBlock(props.block, {
              type: "alert",
              props: { type: value as AlertTypeKeys },
            });
          }}
        >
          <SelectTrigger className="w-fit">
            <SelectValue>
              <div
                className="mx-[12px] flex h-[18px] w-[18px] select-none items-center justify-center rounded-[16px] hover:cursor-pointer"
                style={{
                  backgroundColor: alertTypes[props.block.props.type].color,
                }}
                contentEditable={false}
              >
                {createElement(
                  alertTypes[props.block.props.type].icon,
                  {
                    style: {
                      color: alertTypes[props.block.props.type].backgroundColor,
                    },
                    size: 24,
                  },
                  null,
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(alertTypes).map(([key, value]) => {
                const ItemIcon = value.icon;

                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex w-fit items-center gap-2 text-xs">
                      <ItemIcon size={12} color={value.color} />
                      {key.slice(0, 1).toUpperCase() + key.slice(1)}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className={"inline-content"} ref={props.contentRef} />
      </div>
    ),
  },
);

export const insertAlert = (editor: BlockNoteEditorType) => ({
  title: "Alert",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "alert",
    });
  },

  aliases: [
    "alert",
    "notification",
    "emphasize",
    "warning",
    "error",
    "info",
    "success",
    "callout",
  ],
  group: "Other",
  icon: <AlertCircle />,
  hint: "Used to emphasize text",
});
