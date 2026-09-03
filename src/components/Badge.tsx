const tones = {
  indigo: "bg-indigo/10 text-indigo",
  mustard: "bg-mustard/15 text-[#96760F]",
  green: "bg-green/10 text-green",
  stone: "bg-stone/10 text-[#5A5A6E]",
} as const;

export default function Badge({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}
