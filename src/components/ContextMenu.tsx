export interface ContextMenuProps {
  xPos: any;
  yPos: any;
  // editComment: () => void;
  // deleteHighlight: (id: string) => void;
}

const ContextMenu = ({
  xPos,
  yPos, // editComment,
} // deleteHighlight,
: ContextMenuProps) => {
  return (
    <div className="context-menu" style={{ top: yPos + 2, left: xPos + 2 }}>
      hi
      {/* {/* <button onClick={editComment}>Edit Comment</button> */}
      {/* <button onClick={deleteHighlight}>Delete</button> */}
    </div>
  );
};

export default ContextMenu;
