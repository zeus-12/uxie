import {
  BlockNoteEditor,
  BlockSpec,
  DefaultBlockSchema,
  PropSchema,
  SpecificBlock,
} from "@blocknote/core";
import {
  createReactBlockSpec,
  InlineContent,
  ReactSlashMenuItem,
} from "@blocknote/react";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import ImageDetailsModal from "../ImageDetailsModal";

export const imagePropSchema = {
  // src: {
  //   default: "https://via.placeholder.com/1000",
  // },
  // alt: {
  //   default: "image",
  // },
} satisfies PropSchema;

export const CustomImage = (props: {
  block: SpecificBlock<
    DefaultBlockSchema & { image: BlockSpec<"image", typeof imagePropSchema> },
    "image"
  >;
  editor: BlockNoteEditor<
    DefaultBlockSchema & { image: BlockSpec<"image", typeof imagePropSchema> }
  >;
  theme: "light" | "dark";
}) => {
  console.log("heree");
  const DEFAULT_IMAGE_SRC = "https://via.placeholder.com/1000";
  const [src, setSrc] = useState();
  return (
    <>
      {/* {!src ? ( */}
      <ImageDetailsModal />
      {/* ) : ( */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{
          ...imageStyles,
        }}
      >
        {/* <InlineContent className="flex-grow" /> */}
        <img
          src={src ?? "https://via.placeholder.com/1000"}
          alt="Note snapshot"
          contentEditable={false}
        />
      </div>
      {/* )} */}
    </>
  );
};

export const createImageBlock = (theme: "light" | "dark") =>
  createReactBlockSpec<
    "image",
    typeof imagePropSchema,
    true,
    DefaultBlockSchema & { image: BlockSpec<"image", typeof imagePropSchema> }
  >({
    type: "image" as const,
    propSchema: {
      // src: {
      //   default: "https://via.placeholder.com/1000",
      // },
      // alt: {
      //   default: "image",
      // },
    } as const,
    containsInlineContent: true,
    render: (props: any) => {
      return <CustomImage {...props} theme={theme} />;
    },
  });

export const insertImage = {
  name: "Image",
  execute: (editor) => {
    const text = editor.getSelectedText();
    console.log(text, "text editor texr");

    const block = editor.getTextCursorPosition().block;
    const blockIsEmpty = block.content.length === 0;

    if (blockIsEmpty) {
      editor.updateBlock(block, { type: "image" });
    } else {
      editor.insertBlocks(
        [
          {
            type: "image",
          },
        ],
        editor.getTextCursorPosition().block,
        "after",
      );
      editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
    }
  },
  aliases: ["image", "photo", "snapshot"],
  group: "Other",
  icon: <ImageIcon />,
  hint: "Add Images to your notes",
} satisfies ReactSlashMenuItem<
  DefaultBlockSchema & { image: BlockSpec<"image", typeof imagePropSchema> }
>;

const imageStyles = {
  borderRadius: "4px",
  padding: "4px",
} as const;
