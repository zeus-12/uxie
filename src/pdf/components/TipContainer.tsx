import React, { FC, useEffect, useRef, useState } from "react";

import type { LTWHP } from "../types";

interface Props {
  children: JSX.Element | null;
  style: { top: number; left: number; bottom: number };
  scrollTop: number;
  pageBoundingRect: LTWHP;
}

const clamp = (value: number, left: number, right: number) =>
  Math.min(Math.max(value, left), right);

const TipContainer: FC<Props> = (props) => {
  const { children, style, scrollTop, pageBoundingRect } = props;

  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);

  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(updatePosition, 0);
  }, []);

  useEffect(() => {
    updatePosition();
  }, [children]);

  const updatePosition = () => {
    if (!node.current) {
      return;
    }

    const { offsetHeight, offsetWidth } = node.current;

    setHeight(offsetHeight);
    setWidth(offsetWidth);
  };

  const isStyleCalculationInProgress = width === 0 && height === 0;

  const shouldMove = style.top - height - 5 < scrollTop;

  const top = shouldMove ? style.bottom + 5 : style.top - height - 5;

  const left = clamp(style.left - width / 2, 0, pageBoundingRect.width - width);

  const childrenWithProps = React.Children.map(children, (child) =>
    // @ts-ignore
    React.cloneElement(child, {
      onUpdate: () => {
        setWidth(0);
        setHeight(0);
        setTimeout(updatePosition, 0);
      },
      popup: {
        position: shouldMove ? "below" : "above",
      },
    }),
  );

  return (
    <div
      className="absolute z-[5]"
      style={{
        visibility: isStyleCalculationInProgress ? "hidden" : "visible",
        top,
        left,
      }}
      ref={node}
    >
      {childrenWithProps}
    </div>
  );
};

export default TipContainer;
