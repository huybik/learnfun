import React, { useState, useRef } from "react";
import { MdSend } from "react-icons/md";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  const isActive = focused || text.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 transition-opacity duration-500",
        isActive ? "opacity-100" : "opacity-30 hover:opacity-70",
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={disabled ? "Connecting..." : "Type a message..."}
        className={cn(
          "flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none ring-1 ring-white/10 backdrop-blur transition focus:ring-emerald-500/50",
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
        <MdSend size={18} />
      </button>
    </form>
  );
};
