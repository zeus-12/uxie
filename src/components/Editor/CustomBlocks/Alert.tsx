import { defaultProps } from "@blocknote/core";
import { ReactSlashMenuItem, createReactBlockSpec } from "@blocknote/react";
import { AlertCircle, Ban, Check, Info, ShieldAlertIcon } from "lucide-react";
import { createElement } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { blockSchema } from "@/lib/editor-utils";

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

export const alertBlock = createReactBlockSpec(
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
          // NOT WORKING PROPERLY
          onValueChange={(value) => {
            // console.log(props.block.props.type);
            props.block.props.type = value as
              | "warning"
              | "error"
              | "info"
              | "success";
          }}
          // value={props.block.props.type}
        >
          <SelectTrigger className="w-fit">
            <SelectValue>
              <div
                style={{
                  ...alertIconWrapperStyles,
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

const alertIconWrapperStyles = {
  borderRadius: "16px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  marginLeft: "12px",
  marginRight: "12px",
  height: "18px",
  width: "18px",
  userSelect: "none",
  cursor: "pointer",
} as const;

export const insertAlert: ReactSlashMenuItem<typeof blockSchema> = {
  name: "Alert",
  execute: (editor) => {
    const block = editor.getTextCursorPosition().block;
    const blockIsEmpty = (block.content as any[])?.length === 0;

    if (blockIsEmpty) {
      editor.updateBlock(block, { type: "alert" });
    } else {
      editor.insertBlocks(
        [
          {
            type: "alert",
          },
        ],
        editor.getTextCursorPosition().block,
        "after",
      );
      editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
    }
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
};
