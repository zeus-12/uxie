import DynamicDocViewer from "@/components/DynamicDocViewer";
import Sidebar from "@/components/Sidebar";
import { MouseEvent, useState } from "react";

const DocViewerPage = () => {
  const [width, setWidth] = useState<null | number>();
  const [mouseDown, setMouseDown] = useState(false);

  const handleMouseDown = (event: MouseEvent<HTMLOrSVGElement>) => {
    setMouseDown(true);
    event.preventDefault();
  };

  const handleMouseUp = (_event: MouseEvent<HTMLDivElement>) => {
    setMouseDown(false);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    // if (event.pageX < 300) return;
    if (mouseDown) {
      setWidth(event.pageX);
    }
  };

  return (
    <div
      className="flex"
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div
        className="h-screen "
        style={{ width: width ?? "50vw", minWidth: "25vw" }}
      >
        {/* <DynamicDocViewer /> */}
      </div>
      <div className="flex items-center">
        <svg
          onMouseDown={handleMouseDown}
          className="px-auto w-4 cursor-col-resize "
          viewBox="0 0 16 16"
          fill="#000"
        >
          <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"></path>
        </svg>
      </div>
      <div
        className="h-screen flex-1"
        style={{
          minWidth: "25vw",
        }}
      >
        <Sidebar />
      </div>
    </div>
  );
};
export default DocViewerPage;
