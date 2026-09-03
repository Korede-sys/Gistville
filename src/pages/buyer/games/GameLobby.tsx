import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, LogIn } from "lucide-react";
import { isSupabaseConfigured } from "../../../lib/supabase";
import { generateRoomCode } from "../../../lib/wordGame";

export default function GameLobby() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"choose" | "join">("choose");

  const createRoom = () => {
    const code = generateRoomCode();
    navigate(`/buyer/games/one-letter/${code}?host=1&name=${encodeURIComponent(name || "You")}`);
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    navigate(
      `/buyer/games/one-letter/${joinCode.trim().toUpperCase()}?name=${encodeURIComponent(name || "You")}`
    );
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="px-4 pb-4">
        <Link to="/buyer/games" className="inline-flex items-center gap-1.5 text-sm text-stone mb-4">
          <ArrowLeft size={16} /> Games
        </Link>
        <div className="bg-white border border-stone-light rounded-lg p-5 text-center">
          <p className="text-sm text-ink font-semibold mb-1.5">Multiplayer needs the backend connected</p>
          <p className="text-xs text-stone">
            One Letter uses Supabase Realtime to sync two players live. Set VITE_SUPABASE_URL /
            VITE_SUPABASE_ANON_KEY (already provisioned — see README) and this unlocks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <Link to="/buyer/games" className="inline-flex items-center gap-1.5 text-sm text-stone mb-4">
        <ArrowLeft size={16} /> Games
      </Link>

      <h2 className="text-lg font-semibold text-ink mb-1">One Letter</h2>
      <p className="text-sm text-stone mb-5">
        Change one letter to make a new word. Timer shrinks each round. First to fail loses.
      </p>

      <label className="text-xs font-semibold text-[#4A4A5E] block mb-1.5">Your name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Amaka"
        className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-white text-sm outline-none focus:border-indigo mb-4"
      />

      {mode === "choose" ? (
        <div className="space-y-3">
          <button
            onClick={createRoom}
            className="w-full bg-indigo text-white text-sm font-semibold py-3.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Create a room
          </button>
          <button
            onClick={() => setMode("join")}
            className="w-full border-[1.5px] border-stone-light text-ink text-sm font-semibold py-3.5 rounded-lg flex items-center justify-center gap-2"
          >
            <LogIn size={16} /> Join with a code
          </button>
        </div>
      ) : (
        <div>
          <label className="text-xs font-semibold text-[#4A4A5E] block mb-1.5">Room code</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. K7QRT"
            maxLength={5}
            className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-white text-sm outline-none focus:border-indigo mb-4 tracking-widest font-mono"
          />
          <button
            onClick={joinRoom}
            disabled={!joinCode.trim()}
            className="w-full bg-indigo disabled:bg-stone/40 text-white text-sm font-semibold py-3.5 rounded-lg"
          >
            Join room
          </button>
        </div>
      )}
    </div>
  );
}
