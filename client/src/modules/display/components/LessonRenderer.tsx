import React, { useState } from "react";
import type { FilledBundle } from "@/types/content";

interface LessonRendererProps {
  bundle: FilledBundle;
  /** Current page index within the lesson. */
  currentPage: number;
}

/**
 * Renders a lesson bundle: images, text, and SVG content from filled slots.
 */
export const LessonRenderer: React.FC<LessonRendererProps> = ({
  bundle,
  currentPage,
}) => {
  const [imageError, setImageError] = useState(false);

  // Extract page-specific slots or fall back to global slots
  const pagePrefix = `page_${currentPage}_`;
  const imageSlot =
    bundle.filledSlots[`${pagePrefix}image`] ??
    bundle.filledSlots["image"] ??
    null;
  const textSlot =
    bundle.filledSlots[`${pagePrefix}text`] ??
    bundle.filledSlots["text"] ??
    null;
  const svgSlot =
    bundle.filledSlots[`${pagePrefix}svg`] ??
    bundle.filledSlots["svg"] ??
    null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
      {/* Image content */}
      {imageSlot && !imageError && (
        <div className="relative flex max-h-[70%] w-full items-center justify-center">
          <img
            src={imageSlot}
            alt={`Lesson page ${currentPage + 1}`}
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            onError={() => setImageError(true)}
            draggable={false}
          />
        </div>
      )}

      {imageError && (
        <div className="flex h-40 w-full items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
          Failed to load image
        </div>
      )}

      {/* SVG content */}
      {svgSlot && (
        <div
          className="flex w-full items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svgSlot }}
        />
      )}

      {/* Text content */}
      {textSlot && (
        <div className="max-w-prose text-center text-lg leading-relaxed text-white/90">
          {textSlot}
        </div>
      )}

      {/* Empty state */}
      {!imageSlot && !textSlot && !svgSlot && (
        <div className="text-neutral-500">No content for this page.</div>
      )}
    </div>
  );
};
