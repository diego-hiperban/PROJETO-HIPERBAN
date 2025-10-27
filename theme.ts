export type TenantPalette = {
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
};

const HEX_COLOR_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHex = (value: string, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return fallback;
  }

  const withHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  if (withHash.length === 3) {
    const [r, g, b] = withHash.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return `#${withHash.toLowerCase()}`;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = normalizeHex(hex, '#000000').slice(1);
  const int = parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

const mixChannel = (a: number, b: number, weight: number) => a * (1 - weight) + b * weight;

const mixColors = (base: string, mix: string, weight: number): string => {
  const ratio = Math.max(0, Math.min(1, weight));
  const [r1, g1, b1] = hexToRgb(base);
  const [r2, g2, b2] = hexToRgb(mix);
  return rgbToHex(mixChannel(r1, r2, ratio), mixChannel(g1, g2, ratio), mixChannel(b1, b2, ratio));
};

const getRelativeLuminance = (hex: string): number => {
  const srgb = hexToRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

export const getReadableForeground = (background: string): string => {
  const luminance = getRelativeLuminance(background);
  return luminance > 0.55 ? '#0f172a' : '#ffffff';
};

export const DEFAULT_TENANT_PALETTE: TenantPalette = {
  primary: '#0f172a',
  onPrimary: '#ffffff',
  secondary: '#1e293b',
  onSecondary: '#ffffff',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  accent: '#0ea5e9',
};

export const normalizePalette = (
  palette?: Partial<TenantPalette> | null,
  fallback: TenantPalette = DEFAULT_TENANT_PALETTE,
): TenantPalette | null => {
  if (!palette || typeof palette !== 'object') {
    return null;
  }

  const base: TenantPalette = { ...fallback };
  let hasAny = false;

  (Object.keys(base) as (keyof TenantPalette)[]).forEach((key) => {
    const value = palette[key];
    if (typeof value === 'string' && value.trim()) {
      base[key] = normalizeHex(value, base[key]);
      hasAny = true;
    }
  });

  return hasAny ? base : null;
};

const darken = (color: string, amount: number) => mixColors(color, '#000000', amount);

export const paletteToCssVariables = (palette: TenantPalette): Record<string, string> => {
  const primaryStrong = darken(palette.primary, 0.12);
  const secondaryStrong = darken(palette.secondary, 0.1);
  const mutedText = mixColors(palette.text, palette.background, 0.45);
  const surfaceBorder = mixColors(palette.surface, palette.text, 0.12);
  const surfaceHover = mixColors(palette.surface, palette.text, 0.06);
  const accentStrong = darken(palette.accent, 0.15);

  return {
    '--brand-primary': palette.primary,
    '--brand-primary-strong': primaryStrong,
    '--brand-on-primary': palette.onPrimary,
    '--brand-secondary': palette.secondary,
    '--brand-secondary-strong': secondaryStrong,
    '--brand-on-secondary': palette.onSecondary,
    '--brand-background': palette.background,
    '--brand-surface': palette.surface,
    '--brand-surface-hover': surfaceHover,
    '--brand-surface-border': surfaceBorder,
    '--brand-text': palette.text,
    '--brand-muted-text': mutedText,
    '--brand-accent': palette.accent,
    '--brand-accent-strong': accentStrong,
  };
};

export const mergePalette = (
  existing: TenantPalette | undefined,
  incoming: Partial<TenantPalette> | null | undefined,
): TenantPalette | null => {
  if (!incoming) {
    return null;
  }

  const base = existing ?? DEFAULT_TENANT_PALETTE;
  const merged = normalizePalette({ ...base, ...incoming }, base) ?? null;
  if (!merged) {
    return null;
  }

  return {
    ...merged,
    onPrimary: getReadableForeground(merged.primary),
    onSecondary: getReadableForeground(merged.secondary),
  };
};

export const ensurePalette = (palette?: TenantPalette | null): TenantPalette => {
  const normalized = normalizePalette(palette, DEFAULT_TENANT_PALETTE) ?? DEFAULT_TENANT_PALETTE;
  return {
    ...normalized,
    onPrimary: getReadableForeground(normalized.primary),
    onSecondary: getReadableForeground(normalized.secondary),
  };
};
