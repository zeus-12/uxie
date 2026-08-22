import { READING_STATUS } from "@uxie/shared/components/pdf-reader/constants";
import {
  TTSControlsContent,
  TTSControlsIcon,
} from "@uxie/shared/components/pdf-reader/toolbar/tts-controls";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) flushSync(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderControls(readingStatus: READING_STATUS) {
  const previous = vi.fn();
  const next = vi.fn();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(
    () =>
      root?.render(
        React.createElement(TTSControlsContent, {
          readingStatus,
          startWordByWordHighlighting: vi.fn(),
          pauseReading: vi.fn(),
          resumeReading: vi.fn(),
          stopReading: vi.fn(),
          skipSentence: next,
          skipToPreviousSentence: previous,
          handleReadingSpeedChange: vi.fn(),
          currentReadingSpeed: 1,
          followAlongEnabled: true,
          toggleFollowAlong: vi.fn(),
        }),
      ),
  );

  const button = (name: string) =>
    container!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

  return { button, previous, next };
}

describe("TTS sentence navigation controls", () => {
  it("gives the text-to-speech launcher an accessible name", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    flushSync(() => root?.render(React.createElement(TTSControlsIcon)));

    expect(
      container.querySelector('button[aria-label="Text to speech"]'),
    ).not.toBeNull();
  });

  it("keeps sentence navigation unavailable until reading starts", () => {
    const { button, previous, next } = renderControls(READING_STATUS.IDLE);

    expect(button("Previous sentence")?.disabled).toBe(true);
    expect(button("Next sentence")?.disabled).toBe(true);
    expect(button("Read")).not.toBeNull();

    button("Previous sentence")?.click();
    button("Next sentence")?.click();
    expect(previous).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("moves backward and forward while reading", () => {
    const { button, previous, next } = renderControls(READING_STATUS.READING);

    expect(button("Previous sentence")?.disabled).toBe(false);
    expect(button("Next sentence")?.disabled).toBe(false);
    expect(button("Pause")).not.toBeNull();

    button("Previous sentence")?.click();
    button("Next sentence")?.click();
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it("keeps navigation available while paused", () => {
    const { button } = renderControls(READING_STATUS.PAUSED);

    expect(button("Previous sentence")?.disabled).toBe(false);
    expect(button("Next sentence")?.disabled).toBe(false);
    expect(button("Resume")).not.toBeNull();
  });
});
