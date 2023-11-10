import DocViewer from "@/components/DocViewer";
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
      // TODO add support for touch movements
    >
      <div
        className="h-screen min-w-[25vw] border-stone-200 bg-white sm:rounded-lg sm:border-r sm:shadow-lg"
        style={{ width: width ?? "50vw" }}
      >
        <DocViewer />
      </div>
      <div
        className="group flex w-2 cursor-col-resize items-center justify-center rounded-md bg-gray-50"
        onMouseDown={handleMouseDown}
      >
        <div className="h-1 w-24 rounded-full bg-neutral-400 duration-300 group-hover:bg-primary group-active:bg-primary group-active:duration-75 lg:h-24 lg:w-1" />
      </div>
      <div className="h-screen min-w-[25vw] flex-1">
        <Sidebar />
      </div>
    </div>
  );
};
export default DocViewerPage;
