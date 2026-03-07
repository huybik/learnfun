import React from "react";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  /** Whether the overlay is visible. */
  visible: boolean;
  /** Optional loading message. */
  message?: string;
}

/**
 * Full-screen loading overlay with a spinner.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = "Loading...",
}) => {
  return (
    <div
      className={cn(
        "absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-neutral-900/80 backdrop-blur-sm transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {/* Spinner */}
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-600 border-t-white" />
      <p className="text-sm font-medium text-neutral-300">{message}</p>
    </div>
  );
};
