import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, Check, Trophy, Users } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../../lib/supabase";
import { isLegalMove, randomStartWord } from "../../../lib/wordGame";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Status = "waiting" | "playing" | "finished";

interface StartPayload {
  word: string;
  turnPlayerId: string;
  timerSeconds: number;
  hostId: string;
}
interface MovePayload {
  word: string;
  byPlayerId: string;
  nextTurnPlayerId: string;
  timerSeconds: number;
}
interface TimeoutPayload {
  loserId: string;
}

export default function OneLetterDuel() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [params] = useSearchParams();
  const isHost = params.get("host") === "1";
  const myName = params.get("name") || "You";

  const myId = useRef(crypto.randomUUID()).current;
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [status, setStatus] = useState<Status>("waiting");
  const [opponentPresent, setOpponentPresent] = useState(false);
  const [currentWord, setCurrentWord] = useState("");
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [turnPlayerId, setTurnPlayerId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [score, setScore] = useState({ me: 0, opponent: 0 });
  const [copied, setCopied] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const isMyTurn = status === "playing" && turnPlayerId === myId;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !roomCode) return;

    const channel = supabase.channel(`game:one-letter:${roomCode}`, {
      config: { presence: { key: myId } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "start" }, ({ payload }: { payload: StartPayload }) => {
      setCurrentWord(payload.word);
      setUsedWords([payload.word]);
      setTurnPlayerId(payload.turnPlayerId);
      setTimerSeconds(payload.timerSeconds);
      setSecondsLeft(payload.timerSeconds);
      setStatus("playing");
      setWinnerId(null);
    });

    channel.on("broadcast", { event: "move" }, ({ payload }: { payload: MovePayload }) => {
      setCurrentWord(payload.word);
      setUsedWords((prev) => [...prev, payload.word]);
      setTurnPlayerId(payload.nextTurnPlayerId);
      setTimerSeconds(payload.timerSeconds);
      setSecondsLeft(payload.timerSeconds);
    });

    channel.on("broadcast", { event: "timeout" }, ({ payload }: { payload: TimeoutPayload }) => {
      const iWon = payload.loserId !== myId;
      setWinnerId(iWon ? myId : "opponent");
      setStatus("finished");
      setScore((s) => (iWon ? { ...s, me: s.me + 1 } : { ...s, opponent: s.opponent + 1 }));
    });

    channel.on("broadcast", { event: "rematch" }, ({ payload }: { payload: StartPayload }) => {
      setCurrentWord(payload.word);
      setUsedWords([payload.word]);
      setTurnPlayerId(payload.turnPlayerId);
      setTimerSeconds(payload.timerSeconds);
      setSecondsLeft(payload.timerSeconds);
      setStatus("playing");
      setWinnerId(null);
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const others = Object.keys(state).filter((k) => k !== myId);
      setOpponentPresent(others.length > 0);
      if (others.length > 0) setOpponentLeft(false);
    });

    channel.on("presence", { event: "leave" }, ({ key }: { key: string }) => {
      if (key !== myId) setOpponentLeft(true);
    });

    channel.subscribe(async (subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        await channel.track({ name: myName, joinedAt: Date.now() });
      }
    });

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (!isHost || status !== "waiting" || !opponentPresent) return;
    (async () => {
      const word = await randomStartWord();
      const channel = channelRef.current;
      if (!channel) return;
      const state = channel.presenceState();
      const otherKey = Object.keys(state).find((k) => k !== myId);
      const turnPlayerIdPicked = Math.random() < 0.5 ? myId : otherKey ?? myId;
      const payload: StartPayload = {
        word,
        turnPlayerId: turnPlayerIdPicked,
        timerSeconds: 15,
        hostId: myId,
      };
      await channel.send({ type: "broadcast", event: "start", payload });
      setCurrentWord(word);
      setUsedWords([word]);
      setTurnPlayerId(turnPlayerIdPicked);
      setTimerSeconds(15);
      setSecondsLeft(15);
      setStatus("playing");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, status, opponentPresent]);

  useEffect(() => {
    if (status !== "playing") return;
    if (secondsLeft <= 0) {
      if (isMyTurn) {
        channelRef.current?.send({
          type: "broadcast",
          event: "timeout",
          payload: { loserId: myId } satisfies TimeoutPayload,
        });
        setWinnerId("opponent");
        setStatus("finished");
        setScore((s) => ({ ...s, opponent: s.opponent + 1 }));
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, status, isMyTurn, myId]);

  const submitMove = async () => {
    setError(null);
    const check = await isLegalMove(currentWord, input, usedWords);
    if (!check.ok) {
      setError(check.reason ?? "Invalid move.");
      return;
    }
    const word = input.toLowerCase().trim();
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState();
    const otherKey = Object.keys(state).find((k) => k !== myId);
    const nextTimer = Math.max(5, timerSeconds - 1);
    const payload: MovePayload = {
      word,
      byPlayerId: myId,
      nextTurnPlayerId: otherKey ?? myId,
      timerSeconds: nextTimer,
    };
    await channel.send({ type: "broadcast", event: "move", payload });
    setCurrentWord(word);
    setUsedWords((prev) => [...prev, word]);
    setTurnPlayerId(otherKey ?? myId);
    setTimerSeconds(nextTimer);
    setSecondsLeft(nextTimer);
    setInput("");
  };

  const rematch = async () => {
    const channel = channelRef.current;
    if (!channel) return;
    const word = await randomStartWord();
    const state = channel.presenceState();
    const otherKey = Object.keys(state).find((k) => k !== myId);
    const turnPlayerIdPicked = turnPlayerId === myId ? otherKey ?? myId : myId;
    const payload: StartPayload = { word, turnPlayerId: turnPlayerIdPicked, timerSeconds: 15, hostId: myId };
    await channel.send({ type: "broadcast", event: "rematch", payload });
    setCurrentWord(word);
    setUsedWords([word]);
    setTurnPlayerId(turnPlayerIdPicked);
    setTimerSeconds(15);
    setSecondsLeft(15);
    setStatus("playing");
    setWinnerId(null);
  };

  const copyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-stone">Multiplayer needs the backend connected.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <Link to="/buyer/games" className="inline-flex items-center gap-1.5 text-sm text-stone mb-3">
        <ArrowLeft size={16} /> Leave game
      </Link>

      {status === "waiting" && (
        <div className="bg-white border border-stone-light rounded-sm p-6 text-center">
          <Users size={22} className="text-indigo mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink">Waiting for an opponent...</p>
          <p className="text-xs text-stone mt-1 mb-4">Share this code with a friend</p>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-2 bg-paper border border-stone-light rounded-sm px-4 py-2.5 font-mono text-lg tracking-widest text-ink"
          >
            {roomCode} {copied ? <Check size={16} className="text-green" /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {status !== "waiting" && (
        <>
          <div className="flex items-center justify-between mb-4 text-sm">
            <span className="font-semibold text-ink">You: {score.me}</span>
            <span className="font-mono text-xs text-stone">Room {roomCode}</span>
            <span className="font-semibold text-ink">Opponent: {score.opponent}</span>
          </div>

          {opponentLeft && status === "playing" && (
            <p className="text-xs text-mustard bg-mustard/10 rounded-sm px-3 py-2 mb-3 text-center">
              Opponent disconnected — they may reconnect, or you can leave.
            </p>
          )}

          {status === "playing" && (
            <div className="bg-white border border-stone-light rounded-sm p-6 text-center">
              <p className="text-4xl font-display font-semibold text-ink tracking-wide uppercase">
                {currentWord}
              </p>
              <p
                className={`text-sm font-semibold mt-3 ${
                  secondsLeft <= 3 ? "text-red-600" : "text-stone"
                }`}
              >
                {isMyTurn ? "Your turn" : "Opponent's turn"} — {secondsLeft}s
              </p>

              {isMyTurn && (
                <div className="mt-4">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitMove()}
                    autoFocus
                    placeholder="Type a word..."
                    className="w-full text-center px-3.5 py-3 border-[1.5px] border-stone-light rounded-sm text-lg tracking-wide outline-none focus:border-indigo"
                  />
                  {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
                  <button
                    onClick={submitMove}
                    className="w-full mt-3 bg-indigo text-white text-sm font-semibold py-3 rounded-sm"
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "finished" && (
            <div className="bg-white border border-stone-light rounded-sm p-6 text-center">
              <Trophy size={28} className={winnerId === myId ? "text-mustard mx-auto" : "text-stone mx-auto"} />
              <p className="text-lg font-display font-semibold text-ink mt-2">
                {winnerId === myId ? "You won this round!" : "You lost this round"}
              </p>
              <button
                onClick={rematch}
                className="w-full mt-4 bg-indigo text-white text-sm font-semibold py-3 rounded-sm"
              >
                Rematch
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
