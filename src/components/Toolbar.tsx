import React, { useState } from "react";

interface ToolbarProps {
  setPdfScaleValue: (value: number) => void;
}

const Toolbar = ({ setPdfScaleValue }: ToolbarProps) => {
  const [zoom, setZoom] = useState<number | null>(null);

  const zoomIn = () => {
    if (zoom) {
      if (zoom < 4) {
        setPdfScaleValue(zoom + 0.1);
        setZoom(zoom + 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  const zoomOut = () => {
    if (zoom) {
      if (zoom > 0.2) {
        setPdfScaleValue(zoom - 0.1);
        setZoom(zoom - 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  return (
    <div className="Toolbar">
      <div className="ZoomControls">
        <button onClick={zoomIn}>+</button>
        <button onClick={zoomOut}>-</button>
        {zoom ? `${(zoom * 100).toFixed(0)}%` : "Auto"}
      </div>
    </div>
  );
};

export default Toolbar;
