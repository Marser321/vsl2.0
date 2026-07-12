type BrandmarkProps = {
  size?: number;
  variant?: "light" | "dark";
};

export default function Brandmark({ size = 32, variant = "dark" }: BrandmarkProps) {
  const foreground = variant === "light" ? "#fefefe" : "#01327f";
  const accent = variant === "light" ? "#81e7ff" : "#488eff";

  return (
    <svg
      aria-label="AD Media Solution"
      role="img"
      viewBox="0 0 72 40"
      width={size * 1.8}
      height={size}
      className="shrink-0"
    >
      <text
        x="1"
        y="31"
        fill={foreground}
        fontFamily="var(--font-geist-sans), Arial, sans-serif"
        fontSize="34"
        fontWeight="900"
        letterSpacing="-2.5"
      >
        ad
      </text>
      <circle cx="58" cy="28" r="4" fill={accent} />
    </svg>
  );
}
