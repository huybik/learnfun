import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_VOICES, SUPPORTED_LANGUAGES } from "@/config/constants";
import type { VoiceName, LanguageCode } from "@/config/constants";

const selectClass =
  "w-full rounded-md border border-white/10 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [voice, setVoice] = useState<VoiceName>(DEFAULT_VOICES[0].value);
  const [language, setLanguage] = useState<LanguageCode>(SUPPORTED_LANGUAGES[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: user.displayName,
          voicePreference: voice,
          languageCode: language,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed (${res.status})`);
      }
      const session = await res.json();
      // Store session data for room page to pick up
      localStorage.setItem(
        "learnfun-session",
        JSON.stringify({
          userName: user.displayName,
          userId: session.userId,
          hostId: session.hostId,
          voicePreference: voice,
          languageCode: language,
          sessionId: session.sessionId,
          livekitToken: session.livekitToken,
          livekitUrl: session.livekitUrl,
        })
      );
      console.log("[HomePage] Session created, redirecting to room", session);
      navigate(`/room/${session.roomId}?token=${session.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-white/10 bg-neutral-900 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">LearnFun</h1>
          <p className="text-sm text-neutral-400">
            Welcome, {user?.displayName}
          </p>
        </div>

        <div className="space-y-4">

          <div className="space-y-1">
            <label htmlFor="voice" className="text-xs text-neutral-400">
              AI Voice
            </label>
            <select
              id="voice"
              value={voice}
              onChange={(e) => setVoice(e.target.value as VoiceName)}
              className={selectClass}
            >
              {DEFAULT_VOICES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="language" className="text-xs text-neutral-400">
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className={selectClass}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Creating session..." : "Start Learning"}
          </button>
          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}
          <button
            onClick={logout}
            className="w-full rounded-md border border-white/10 px-3 py-2 text-sm text-neutral-400 transition hover:text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
