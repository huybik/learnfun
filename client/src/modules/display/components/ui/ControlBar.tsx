import React from "react";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  /** Whether the microphone is muted. */
  isMuted: boolean;
  onMuteToggle: () => void;
  /** Whether the camera is active. */
  isCameraOn: boolean;
  onCameraToggle: () => void;
  /** Whether a game is active (shows end game button). */
  isGameActive: boolean;
  onEndGame?: () => void;
  /** Connection state for visual indicators. */
  connectionState?: "connected" | "disconnected" | "paused";
  /** Connection lifecycle callbacks. */
  onConnect?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

/**
 * Bottom control bar: mic toggle, camera toggle, connection controls.
 */
export const ControlBar: React.FC<ControlBarProps> = ({
  isMuted,
  onMuteToggle,
  isCameraOn,
  onCameraToggle,
  isGameActive,
  onEndGame,
  connectionState = "disconnected",
  onConnect,
  onPause,
  onResume,
}) => {

  return (
    <section className="absolute bottom-0 left-0 right-0 z-50 flex flex-col items-center pb-4">
      {/* Main controls cluster */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-full bg-neutral-800/80 px-4 py-2 shadow-xl backdrop-blur",
          connectionState !== "disconnected" && "ring-1 ring-white/10",
        )}
      >
        {/* Mic toggle */}
        <button
          onClick={onMuteToggle}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition",
            isMuted
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-white/10 text-white hover:bg-white/20",
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 1a3 3 0 00-3 3v4a3 3 0 006 0V4a3 3 0 00-3-3z" />
            )}
          </svg>
        </button>

        {/* Camera toggle */}
        <button
          onClick={onCameraToggle}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition",
            isCameraOn
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-white/5 text-white/50 hover:bg-white/10",
          )}
          title={isCameraOn ? "Turn camera off" : "Turn camera on"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isCameraOn ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
            )}
          </svg>
        </button>

        {/* End game button (only during games) */}
        {isGameActive && onEndGame && (
          <button
            onClick={onEndGame}
            className="flex h-9 items-center gap-1 rounded-full bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
            title="End game"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            End
          </button>
        )}

        {/* Connect / Pause / Resume button */}
        <button
          onClick={
            connectionState === "disconnected"
              ? onConnect
              : connectionState === "connected"
                ? onPause
                : onResume
          }
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition",
            connectionState === "disconnected"
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : connectionState === "connected"
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-amber-600 text-white hover:bg-amber-500",
          )}
          title={
            connectionState === "disconnected"
              ? "Connect to AI"
              : connectionState === "connected"
                ? "Pause"
                : "Resume"
          }
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {connectionState === "disconnected" ? (
              // Play icon
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            ) : connectionState === "connected" ? (
              // Pause icon
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
            ) : (
              // Resume (play) icon
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            )}
          </svg>
        </button>
      </div>
    </section>
  );
};
