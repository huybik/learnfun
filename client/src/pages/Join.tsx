import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function JoinPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!name.trim() || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userName: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `Failed (${res.status})`);
      }
      const session = await res.json();
      localStorage.setItem(
        "learnfun-session",
        JSON.stringify({
          userName: name.trim(),
          sessionId,
          livekitToken: session.livekitToken,
          livekitUrl: session.livekitUrl,
        }),
      );
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
          <h1 className="text-2xl font-bold tracking-tight">Join Session</h1>
          <p className="text-sm text-neutral-400">
            Enter your name to join the learning session
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
            className="w-full rounded-md border border-white/10 bg-neutral-800 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />

          <button
            onClick={handleJoin}
            disabled={!name.trim() || loading}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join"}
          </button>
          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
