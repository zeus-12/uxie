import { FC } from "react";
import type { LTWHP } from "../types";

interface Props {
  position: {
    rects: Array<LTWHP>;
  };
  onClick?: () => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  isScrolledTo: boolean;
}

export const Highlight: FC<Props> = (props) => {
  const { position, onClick, onMouseOver, onMouseOut, isScrolledTo } = props;
  const { rects } = position;

  return (
    <div
      className={`absolute`}
      style={{
        background: isScrolledTo ? "#ff4141" : "#FFE28F",
      }}
    >
      <div className="opacity-100">
        {rects.map((rect, index) => (
          <div
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
            onClick={onClick}
            key={index}
            style={{
              ...rect,
              background: "#FFE28F",
              position: "absolute",
              transition: "background 0.3s ease",
            }}
            className="cursor-pointer"
          />
        ))}
      </div>
    </div>
  );
};
