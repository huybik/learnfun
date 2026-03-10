import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function JoinPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!user || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userName: user.displayName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `Failed (${res.status})`);
      }
      const session = await res.json();
      localStorage.setItem(
        "learnfun-session",
        JSON.stringify({
          userName: user.displayName,
          userId: session.userId,
          hostId: session.hostId,
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
            Joining as {user?.displayName}
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join Session"}
          </button>
          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
