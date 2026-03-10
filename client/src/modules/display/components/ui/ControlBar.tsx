import React from "react";
import { MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdClose, MdPowerSettingsNew, MdPause, MdPlayArrow } from "react-icons/md";
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
  /** Extra elements rendered inside the control bar cluster. */
  children?: React.ReactNode;
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
  children,
}) => {

  return (
    <section className="absolute bottom-0 right-4 z-50 flex w-80 flex-col items-center pb-4 opacity-30 transition-opacity duration-500 hover:opacity-100">
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
          {isMuted ? <MdMicOff size={20} /> : <MdMic size={20} />}
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
          {isCameraOn ? <MdVideocam size={20} /> : <MdVideocamOff size={20} />}
        </button>

        {/* End game button (only during games) */}
        {isGameActive && onEndGame && (
          <button
            onClick={onEndGame}
            className="flex h-9 items-center gap-1 rounded-full bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
            title="End game"
          >
            <MdClose size={18} />
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
          {connectionState === "disconnected" ? <MdPowerSettingsNew size={20} /> : connectionState === "connected" ? <MdPause size={20} /> : <MdPlayArrow size={20} />}
        </button>

        {children}
      </div>
    </section>
  );
};
