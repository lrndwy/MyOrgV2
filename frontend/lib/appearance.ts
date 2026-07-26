/**
 * Engine kustomisasi tampilan.
 *
 * Konfigurasi (style, base color, warna primer, palet chart, font, radius)
 * disimpan sebagai JSON di kolom `appearance` organization_settings, lalu
 * diterjemahkan menjadi CSS variables (:root + .dark) yang di-inject ke <head>
 * saat runtime — menimpa default `globals.css` (preset shadcn base-mira).
 */

export type StyleKey =
  | "mira"
  | "vega"
  | "nova"
  | "mala"
  | "lyra"
  | "luma"
  | "sera"
  | "rhea"

export type BaseKey = "neutral" | "stone" | "zinc" | "gray" | "slate"

export type PrimaryKey =
  | "mono"
  | "cyan"
  | "blue"
  | "teal"
  | "emerald"
  | "amber"
  | "orange"
  | "rose"
  | "violet"
  | "purple"

export type ChartKey = "primary" | "vivid" | "ocean" | "sunset" | "forest"

export type FontKey =
  | "inter"
  | "poppins"
  | "manrope"
  | "space-grotesk"
  | "jakarta"
  | "lora"

export interface AppearanceConfig {
  style: StyleKey
  base: BaseKey
  primary: PrimaryKey
  chart: ChartKey
  headingFont: FontKey
  textFont: FontKey
  radius: number
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  style: "mira",
  base: "neutral",
  primary: "cyan",
  chart: "primary",
  headingFont: "inter",
  textFont: "inter",
  radius: 0.625,
}

// ---------------------------------------------------------------------------
// Opsi

export const FONT_OPTIONS: Record<FontKey, { label: string; cssVar: string }> =
  {
    inter: { label: "Inter", cssVar: "--font-inter" },
    poppins: { label: "Poppins", cssVar: "--font-poppins" },
    manrope: { label: "Manrope", cssVar: "--font-manrope" },
    "space-grotesk": {
      label: "Space Grotesk",
      cssVar: "--font-space-grotesk",
    },
    jakarta: { label: "Plus Jakarta Sans", cssVar: "--font-jakarta" },
    lora: { label: "Lora", cssVar: "--font-lora" },
  }

export const RADIUS_OPTIONS = [0, 0.25, 0.5, 0.625, 0.75, 1] as const

interface BaseFamily {
  label: string
  c: number
  h: number
}

export const BASE_COLORS: Record<BaseKey, BaseFamily> = {
  neutral: { label: "Neutral", c: 0, h: 0 },
  stone: { label: "Stone", c: 0.013, h: 58 },
  zinc: { label: "Zinc", c: 0.016, h: 286 },
  gray: { label: "Gray", c: 0.023, h: 264 },
  slate: { label: "Slate", c: 0.046, h: 257 },
}

interface Oklch {
  l: number
  c: number
  h: number
}

interface PrimaryColor {
  label: string
  light: Oklch
  dark: Oklch
  /** Teks di atas warna primer (light & dark memakai nilai sama). */
  fg: string
  fgDark?: string
}

export const PRIMARY_COLORS: Record<PrimaryKey, PrimaryColor> = {
  mono: {
    label: "Mono",
    light: { l: 0.205, c: 0, h: 0 },
    dark: { l: 0.922, c: 0, h: 0 },
    fg: "oklch(0.985 0 0)",
    fgDark: "oklch(0.205 0 0)",
  },
  cyan: {
    label: "Cyan",
    light: { l: 0.52, c: 0.105, h: 223.128 },
    dark: { l: 0.45, c: 0.085, h: 224.283 },
    fg: "oklch(0.984 0.019 200.873)",
  },
  blue: {
    label: "Blue",
    light: { l: 0.546, c: 0.245, h: 262.881 },
    dark: { l: 0.623, c: 0.214, h: 259.815 },
    fg: "oklch(0.984 0.014 254)",
  },
  teal: {
    label: "Teal",
    light: { l: 0.511, c: 0.096, h: 186.391 },
    dark: { l: 0.6, c: 0.104, h: 180.72 },
    fg: "oklch(0.984 0.014 180)",
  },
  emerald: {
    label: "Emerald",
    light: { l: 0.596, c: 0.145, h: 163.225 },
    dark: { l: 0.508, c: 0.118, h: 165.612 },
    fg: "oklch(0.979 0.021 166)",
  },
  amber: {
    label: "Amber",
    light: { l: 0.555, c: 0.163, h: 48.998 },
    dark: { l: 0.666, c: 0.179, h: 58.318 },
    fg: "oklch(0.987 0.022 95)",
  },
  orange: {
    label: "Orange",
    light: { l: 0.553, c: 0.195, h: 38.402 },
    dark: { l: 0.646, c: 0.222, h: 41.116 },
    fg: "oklch(0.98 0.016 73)",
  },
  rose: {
    label: "Rose",
    light: { l: 0.586, c: 0.253, h: 17.585 },
    dark: { l: 0.645, c: 0.246, h: 16.439 },
    fg: "oklch(0.969 0.015 12)",
  },
  violet: {
    label: "Violet",
    light: { l: 0.541, c: 0.281, h: 293.009 },
    dark: { l: 0.606, c: 0.25, h: 292.717 },
    fg: "oklch(0.969 0.016 294)",
  },
  purple: {
    label: "Purple",
    light: { l: 0.558, c: 0.288, h: 302.321 },
    dark: { l: 0.627, c: 0.265, h: 303.9 },
    fg: "oklch(0.977 0.014 308)",
  },
}

export const CHART_PALETTES: Record<
  ChartKey,
  { label: string; colors?: string[] }
> = {
  // "primary" dihitung dari hue warna primer terpilih (lihat chartColors()).
  primary: { label: "Selaras warna primer" },
  vivid: {
    label: "Vivid",
    colors: [
      "oklch(0.646 0.222 41.116)",
      "oklch(0.6 0.118 184.704)",
      "oklch(0.398 0.07 227.392)",
      "oklch(0.828 0.189 84.429)",
      "oklch(0.769 0.188 70.08)",
    ],
  },
  ocean: {
    label: "Ocean",
    colors: [
      "oklch(0.546 0.245 262.881)",
      "oklch(0.6 0.118 184.704)",
      "oklch(0.715 0.143 215.221)",
      "oklch(0.488 0.243 264.376)",
      "oklch(0.696 0.17 162.48)",
    ],
  },
  sunset: {
    label: "Sunset",
    colors: [
      "oklch(0.646 0.222 41.116)",
      "oklch(0.769 0.188 70.08)",
      "oklch(0.645 0.246 16.439)",
      "oklch(0.586 0.253 17.585)",
      "oklch(0.837 0.128 66.29)",
    ],
  },
  forest: {
    label: "Forest",
    colors: [
      "oklch(0.596 0.145 163.225)",
      "oklch(0.723 0.219 149.579)",
      "oklch(0.527 0.154 150.069)",
      "oklch(0.848 0.199 131.684)",
      "oklch(0.6 0.104 180.72)",
    ],
  },
}

/**
 * Preset gaya ala shadcn (vega, nova, mala, lyra, mira, luma, sera, rhea).
 * Token resmi registry premium shadcn tidak tersedia untuk disalin, jadi tiap
 * preset di sini adalah kurasi kombinasi parameter yang mengikuti karakter
 * masing-masing style; semua parameter tetap bisa diubah satu-satu.
 */
export const STYLE_PRESETS: Record<
  StyleKey,
  { label: string; config: Omit<AppearanceConfig, "style"> }
> = {
  mira: {
    label: "Mira",
    config: {
      base: "neutral",
      primary: "cyan",
      chart: "primary",
      headingFont: "inter",
      textFont: "inter",
      radius: 0.625,
    },
  },
  vega: {
    label: "Vega",
    config: {
      base: "zinc",
      primary: "violet",
      chart: "vivid",
      headingFont: "space-grotesk",
      textFont: "inter",
      radius: 0.5,
    },
  },
  nova: {
    label: "Nova",
    config: {
      base: "slate",
      primary: "blue",
      chart: "ocean",
      headingFont: "jakarta",
      textFont: "jakarta",
      radius: 0.75,
    },
  },
  mala: {
    label: "Mala",
    config: {
      base: "stone",
      primary: "amber",
      chart: "sunset",
      headingFont: "lora",
      textFont: "inter",
      radius: 0.5,
    },
  },
  lyra: {
    label: "Lyra",
    config: {
      base: "slate",
      primary: "purple",
      chart: "vivid",
      headingFont: "poppins",
      textFont: "inter",
      radius: 1,
    },
  },
  luma: {
    label: "Luma",
    config: {
      base: "gray",
      primary: "emerald",
      chart: "forest",
      headingFont: "manrope",
      textFont: "manrope",
      radius: 0.75,
    },
  },
  sera: {
    label: "Sera",
    config: {
      base: "stone",
      primary: "rose",
      chart: "sunset",
      headingFont: "lora",
      textFont: "manrope",
      radius: 0.625,
    },
  },
  rhea: {
    label: "Rhea",
    config: {
      base: "zinc",
      primary: "mono",
      chart: "vivid",
      headingFont: "space-grotesk",
      textFont: "space-grotesk",
      radius: 0.25,
    },
  },
}

// ---------------------------------------------------------------------------
// Serialisasi

export function parseAppearance(raw?: string | null): AppearanceConfig | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const cfg: AppearanceConfig = { ...DEFAULT_APPEARANCE }
    if (typeof data.style === "string" && data.style in STYLE_PRESETS) {
      cfg.style = data.style as StyleKey
    }
    if (typeof data.base === "string" && data.base in BASE_COLORS) {
      cfg.base = data.base as BaseKey
    }
    if (typeof data.primary === "string" && data.primary in PRIMARY_COLORS) {
      cfg.primary = data.primary as PrimaryKey
    }
    if (typeof data.chart === "string" && data.chart in CHART_PALETTES) {
      cfg.chart = data.chart as ChartKey
    }
    if (
      typeof data.heading_font === "string" &&
      data.heading_font in FONT_OPTIONS
    ) {
      cfg.headingFont = data.heading_font as FontKey
    }
    if (typeof data.text_font === "string" && data.text_font in FONT_OPTIONS) {
      cfg.textFont = data.text_font as FontKey
    }
    if (typeof data.radius === "number" && data.radius >= 0 && data.radius <= 2) {
      cfg.radius = data.radius
    }
    return cfg
  } catch {
    return null
  }
}

export function serializeAppearance(cfg: AppearanceConfig): string {
  return JSON.stringify({
    style: cfg.style,
    base: cfg.base,
    primary: cfg.primary,
    chart: cfg.chart,
    heading_font: cfg.headingFont,
    text_font: cfg.textFont,
    radius: cfg.radius,
  })
}

// ---------------------------------------------------------------------------
// Pembangkit CSS

function oklch(l: number, c: number, h: number): string {
  const cc = Math.max(0, +c.toFixed(4))
  return `oklch(${+l.toFixed(3)} ${cc} ${+h.toFixed(3)})`
}

function tint(l: number, f: BaseFamily, scale: number): string {
  return oklch(l, f.c * scale, f.h)
}

export function chartColors(cfg: AppearanceConfig): string[] {
  const palette = CHART_PALETTES[cfg.chart]
  if (palette.colors) return palette.colors
  // Ramp dari hue warna primer, meniru gradasi chart preset mira.
  const p = PRIMARY_COLORS[cfg.primary].light
  const scale = p.c > 0 ? Math.min(p.c / 0.105, 1.6) : 0
  const ramp: Array<[number, number]> = [
    [0.865, 0.127],
    [0.715, 0.143],
    [0.609, 0.126],
    [0.52, 0.105],
    [0.45, 0.085],
  ]
  const hue = p.c > 0 ? p.h : 264
  const chroma = p.c > 0 ? scale : 0.35 // mono → ramp abu kebiruan
  return ramp.map(([l, c]) => oklch(l, c * chroma, hue))
}

function colorTokens(cfg: AppearanceConfig): {
  light: Record<string, string>
  dark: Record<string, string>
} {
  const f = BASE_COLORS[cfg.base]
  const p = PRIMARY_COLORS[cfg.primary]
  const charts = chartColors(cfg)

  const light: Record<string, string> = {
    background: "oklch(1 0 0)",
    foreground: tint(0.145, f, 0.9),
    card: "oklch(1 0 0)",
    "card-foreground": tint(0.145, f, 0.9),
    popover: "oklch(1 0 0)",
    "popover-foreground": tint(0.145, f, 0.9),
    primary: oklch(p.light.l, p.light.c, p.light.h),
    "primary-foreground": p.fg,
    secondary: tint(0.967, f, 0.15),
    "secondary-foreground": tint(0.21, f, 0.9),
    muted: tint(0.97, f, 0.15),
    "muted-foreground": tint(0.556, f, 1),
    accent: tint(0.97, f, 0.15),
    "accent-foreground": tint(0.205, f, 0.9),
    destructive: "oklch(0.577 0.245 27.325)",
    border: tint(0.922, f, 0.3),
    input: tint(0.922, f, 0.3),
    ring: tint(0.708, f, 0.6),
    sidebar: tint(0.985, f, 0.1),
    "sidebar-foreground": tint(0.145, f, 0.9),
    "sidebar-primary": oklch(p.light.l, p.light.c, p.light.h),
    "sidebar-primary-foreground": p.fg,
    "sidebar-accent": tint(0.97, f, 0.15),
    "sidebar-accent-foreground": tint(0.205, f, 0.9),
    "sidebar-border": tint(0.922, f, 0.3),
    "sidebar-ring": tint(0.708, f, 0.6),
  }

  const dark: Record<string, string> = {
    background: tint(0.145, f, 0.9),
    foreground: tint(0.985, f, 0.08),
    card: tint(0.205, f, 0.9),
    "card-foreground": tint(0.985, f, 0.08),
    popover: tint(0.205, f, 0.9),
    "popover-foreground": tint(0.985, f, 0.08),
    primary: oklch(p.dark.l, p.dark.c, p.dark.h),
    "primary-foreground": p.fgDark ?? p.fg,
    secondary: tint(0.274, f, 0.4),
    "secondary-foreground": tint(0.985, f, 0.08),
    muted: tint(0.269, f, 0.5),
    "muted-foreground": tint(0.708, f, 0.6),
    accent: tint(0.269, f, 0.5),
    "accent-foreground": tint(0.985, f, 0.08),
    destructive: "oklch(0.704 0.191 22.216)",
    border: "oklch(1 0 0 / 10%)",
    input: "oklch(1 0 0 / 15%)",
    ring: tint(0.556, f, 0.6),
    sidebar: tint(0.205, f, 0.9),
    "sidebar-foreground": tint(0.985, f, 0.08),
    "sidebar-primary": oklch(p.dark.l, p.dark.c, p.dark.h),
    "sidebar-primary-foreground": p.fgDark ?? p.fg,
    "sidebar-accent": tint(0.269, f, 0.5),
    "sidebar-accent-foreground": tint(0.985, f, 0.08),
    "sidebar-border": "oklch(1 0 0 / 10%)",
    "sidebar-ring": tint(0.556, f, 0.6),
  }

  charts.forEach((color, i) => {
    light[`chart-${i + 1}`] = color
    dark[`chart-${i + 1}`] = color
  })

  return { light, dark }
}

export function buildAppearanceCss(cfg: AppearanceConfig): string {
  const { light, dark } = colorTokens(cfg)
  const fontRules = [
    `--font-sans: var(${FONT_OPTIONS[cfg.textFont].cssVar});`,
    `--font-heading: var(${FONT_OPTIONS[cfg.headingFont].cssVar});`,
    `--radius: ${cfg.radius}rem;`,
  ]
  const rootRules = Object.entries(light)
    .map(([k, v]) => `--${k}: ${v};`)
    .concat(fontRules)
    .join("\n  ")
  const darkRules = Object.entries(dark)
    .map(([k, v]) => `--${k}: ${v};`)
    .join("\n  ")
  return `:root {\n  ${rootRules}\n}\n.dark {\n  ${darkRules}\n}`
}

const STYLE_TAG_ID = "app-appearance"

/**
 * Terapkan (atau hapus, jika null) konfigurasi tampilan secara live dengan
 * meng-inject <style> di akhir <head> — menang atas globals.css karena urutan.
 */
export function applyAppearance(cfg: AppearanceConfig | null): void {
  if (typeof document === "undefined") return
  const existing = document.getElementById(STYLE_TAG_ID)
  if (!cfg) {
    existing?.remove()
    return
  }
  const css = buildAppearanceCss(cfg)
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css
    // Pastikan tetap paling akhir di <head> agar menang dari style lain.
    if (existing !== document.head.lastElementChild) {
      document.head.appendChild(existing)
    }
    return
  }
  const style = document.createElement("style")
  style.id = STYLE_TAG_ID
  style.textContent = css
  document.head.appendChild(style)
}
