const tones = {
  indigo: "bg-indigo text-white",
  mustard: "bg-mustard text-ink",
  green: "bg-green text-white",
  stone: "bg-ink/5 text-ink/70",
} as const;

export default function Badge({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`tag-label text-[10px] px-2 py-0.5 rounded-sm ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
