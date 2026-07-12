// import { schema } from "@/lib/editor-utils";
// import {
//   ToolbarButton,
//   createReactInlineContentSpec,
//   useBlockNoteEditor,
// } from "@blocknote/react";

// export const Comment = createReactInlineContentSpec(
//   {
//     type: "comment",
//     propSchema: {
//       comment: {
//         default: "",
//       },
//       text: {
//         default: "",
//       },
//     },
//     content: "none",
//   },
//   {
//     render: (props) => (
//       <span
//         onClick={() => alert(props.inlineContent.props.comment)}
//         style={{ backgroundColor: "#FEF2CD" }}
//       >
//         {props.inlineContent.props.text}
//       </span>
//     ),
//   },
// );

// export function CommentFormattingToolbarButton() {
//   const editor = useBlockNoteEditor(schema);

//   // const [isSelected, setIsSelected] = useState<boolean>();

//   // useEditorContentOrSelectionChange(() => {
//   //   setIsSelected(
//   //     editor.getActiveStyles().textColor === "blue" &&
//   //       editor.getActiveStyles().backgroundColor === "blue",
//   //   );
//   // }, editor);

//   return (
//     <ToolbarButton
//       mainTooltip={"Blue Text & Background"}
//       onClick={() => {
//         editor.insertInlineContent([
//           "",
//           {
//             type: "comment",
//             props: {
//               comment: "This is a comment",
//               text: editor.getSelectedText(),
//             },
//           },
//         ]);
//       }}
//       // isSelected={isSelected}
//     >
//       Add Comment
//     </ToolbarButton>
//   );
// }
