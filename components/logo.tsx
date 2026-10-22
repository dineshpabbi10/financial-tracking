export function Logo({
  size = 34,
  tone = "dark",
}: {
  size?: number;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background:
          "radial-gradient(circle at 32% 26%, #f4dda5 0%, #d9ae5b 46%, #b8862d 100%)",
        color: "#123c2c",
        boxShadow:
          tone === "light"
            ? "inset 0 0 0 1.5px rgba(255,255,255,.35), 0 4px 16px rgba(0,0,0,.18)"
            : "inset 0 0 0 1.5px rgba(255,255,255,.32), 0 2px 6px rgba(32,29,23,.12)",
      }}
      aria-hidden
    >
      L
    </span>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo size={32} tone={light ? "light" : "dark"} />
      <span
        className={`font-display text-[22px] font-semibold tracking-tight ${
          light ? "text-paper" : "text-ink"
        }`}
      >
        Loonie
      </span>
    </span>
  );
}
