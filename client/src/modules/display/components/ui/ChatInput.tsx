import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2 border-t border-white/5 px-3 py-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "Connecting..." : "Type a message..."}
        className={cn(
          "flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none ring-1 ring-white/10 transition focus:ring-emerald-500/50",
          disabled && "opacity-40 cursor-not-allowed",
        )}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
          text.trim() && !disabled
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-white/5 text-neutral-500 cursor-not-allowed",
        )}
        title="Send"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  );
};
