let cache: Set<string> | null = null;
let fourFive: string[] | null = null;

async function loadWords(): Promise<{ set: Set<string>; startCandidates: string[] }> {
  if (cache && fourFive) return { set: cache, startCandidates: fourFive };
  const res = await fetch("/words.json");
  const words: string[] = await res.json();
  cache = new Set(words);
  fourFive = words.filter((w) => w.length === 4 || w.length === 5);
  return { set: cache, startCandidates: fourFive };
}

export async function isValidWord(word: string): Promise<boolean> {
  const { set } = await loadWords();
  return set.has(word.toLowerCase());
}

export async function randomStartWord(): Promise<string> {
  const { startCandidates } = await loadWords();
  return startCandidates[Math.floor(Math.random() * startCandidates.length)];
}

export function isOneLetterDifferent(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

export async function isLegalMove(
  currentWord: string,
  nextWord: string,
  usedWords: string[]
): Promise<{ ok: boolean; reason?: string }> {
  const word = nextWord.toLowerCase().trim();
  if (!word) return { ok: false, reason: "Enter a word." };
  if (usedWords.includes(word)) return { ok: false, reason: "Already used this game." };
  if (!isOneLetterDifferent(currentWord, word)) {
    return { ok: false, reason: "Change exactly one letter." };
  }
  if (!(await isValidWord(word))) return { ok: false, reason: "Not a word." };
  return { ok: true };
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
