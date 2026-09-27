import type { SiteTheme } from "./types";

/* ==========================================================================
   NEXORA — Theme system
   Each theme is a full design token set. The Strategy Agent picks a theme
   based on industry + positioning so two restaurants do not look identical.
   ========================================================================== */

export const THEMES: Record<string, SiteTheme> = {
  indigo: {
    palette: "indigo",
    primary: "#6366f1",
    primaryDark: "#4338ca",
    accent: "#22d3ee",
    neutral: "#0f172a",
    bg: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#64748b",
    fontHeading: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "10px",
    radiusLg: "18px",
    mood: "modern-tech",
  },
  emerald: {
    palette: "emerald",
    primary: "#059669",
    primaryDark: "#065f46",
    accent: "#84cc16",
    neutral: "#052e16",
    bg: "#ffffff",
    surface: "#f0fdf4",
    text: "#0b2318",
    muted: "#5b7a6c",
    fontHeading: "'Fraunces', 'Georgia', serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "14px",
    radiusLg: "24px",
    mood: "organic-wellness",
  },
  crimson: {
    palette: "crimson",
    primary: "#dc2626",
    primaryDark: "#991b1b",
    accent: "#f59e0b",
    neutral: "#1c1917",
    bg: "#fffbf7",
    surface: "#fef3ec",
    text: "#1c1917",
    muted: "#7c6a5d",
    fontHeading: "'Playfair Display', 'Georgia', serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "8px",
    radiusLg: "20px",
    mood: "warm-appetite",
  },
  midnight: {
    palette: "midnight",
    primary: "#0ea5e9",
    primaryDark: "#0369a1",
    accent: "#a78bfa",
    neutral: "#020617",
    bg: "#020617",
    surface: "#0b1220",
    text: "#e2e8f0",
    muted: "#94a3b8",
    fontHeading: "'Space Grotesk', 'Inter', sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "12px",
    radiusLg: "22px",
    mood: "dark-premium",
  },
  amber: {
    palette: "amber",
    primary: "#b45309",
    primaryDark: "#78350f",
    accent: "#0d9488",
    neutral: "#1c1917",
    bg: "#fffbeb",
    surface: "#fef9e7",
    text: "#1c1917",
    muted: "#7a6a52",
    fontHeading: "'DM Serif Display', 'Georgia', serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "6px",
    radiusLg: "16px",
    mood: "artisan-boutique",
  },
  slate: {
    palette: "slate",
    primary: "#334155",
    primaryDark: "#0f172a",
    accent: "#0ea5e9",
    neutral: "#020617",
    bg: "#ffffff",
    surface: "#f1f5f9",
    text: "#0f172a",
    muted: "#64748b",
    fontHeading: "'Inter Tight', 'Inter', sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "4px",
    radiusLg: "10px",
    mood: "corporate-trust",
  },
  rose: {
    palette: "rose",
    primary: "#e11d48",
    primaryDark: "#9f1239",
    accent: "#f472b6",
    neutral: "#1f0713",
    bg: "#fff5f8",
    surface: "#ffe9f0",
    text: "#1f0713",
    muted: "#8a5f72",
    fontHeading: "'Cormorant Garamond', 'Georgia', serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "999px",
    radiusLg: "28px",
    mood: "soft-lifestyle",
  },
  teal: {
    palette: "teal",
    primary: "#0d9488",
    primaryDark: "#115e59",
    accent: "#facc15",
    neutral: "#042f2e",
    bg: "#f7fdfc",
    surface: "#e6fbf8",
    text: "#042f2e",
    muted: "#5c8a85",
    fontHeading: "'Outfit', 'Inter', sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: "16px",
    radiusLg: "28px",
    mood: "clinical-calm",
  },
};

export const THEME_KEYS = Object.keys(THEMES);

/** Deterministic palette selection for a category + positioning. */
export function pickTheme(category: string, positioning: string): SiteTheme {
  const c = category.toLowerCase();
  const table: Array<[RegExp, string]> = [
    [/restaurant|food|cafe|bakery|diner|bistro|kitchen/, "crimson"],
    [/coaching|academy|institute|school|tuition|training|education|college/, "indigo"],
    [/gym|fitness|yoga|crossfit|sports/, "midnight"],
    [/dental|clinic|doctor|hospital|medical|health|pharma/, "teal"],
    [/salon|spa|beauty|makeup|studio/, "rose"],
    [/retail|store|shop|boutique|fashion|apparel/, "amber"],
    [/construction|real estate|interior|architect|property|builders/, "slate"],
    [/travel|tour|hotel|resort|hospitality/, "emerald"],
    [/agency|consult|professional|law|ca |finance/, "indigo"],
    [/portfolio|photograph|design|artist/, "midnight"],
  ];
  for (const [re, key] of table) if (re.test(c)) return THEMES[key]!;
  return positioning === "dark-premium" ? THEMES.midnight! : THEMES.indigo!;
}

export function googleFontsLink(theme: SiteTheme): string {
  const fonts = new Set<string>();
  for (const f of [theme.fontHeading, theme.fontBody]) {
    const m = f.match(/'([^']+)'/);
    if (m) fonts.add(m[1]!);
  }
  if (fonts.size === 0) return "";
  const family = Array.from(fonts)
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${family}&display=swap`;
}
