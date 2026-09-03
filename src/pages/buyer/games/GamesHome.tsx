import { Link } from "react-router-dom";
import { Gamepad2, Users, Clock } from "lucide-react";

export default function GamesHome() {
  return (
    <div className="px-4 pb-4">
      <p className="text-[11px] font-mono tracking-wide text-stone uppercase mb-1">
        GistVille Games
      </p>
      <h2 className="text-lg font-semibold text-ink mb-4">Play with someone, right now</h2>

      <Link
        to="/buyer/games/one-letter"
        className="block bg-white border border-stone-light rounded-xl p-4 active:scale-[0.99] transition"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-indigo/10 flex items-center justify-center shrink-0">
            <Gamepad2 size={20} className="text-indigo" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">One Letter</h3>
            <p className="text-xs text-[#5A5A6E] mt-0.5">
              Change one letter to make a new word before the timer runs out. 2-player duel.
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-stone">
              <span className="flex items-center gap-1">
                <Users size={11} /> 2 players
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> 15s → 5s
              </span>
            </div>
          </div>
        </div>
      </Link>

      <p className="text-[11px] text-stone text-center mt-6">More games coming soon.</p>
    </div>
  );
}
