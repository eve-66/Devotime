export type ThemePreferences = {
  outerBackgroundColor: string;
  innerBackgroundColor: string;
};

export const DEFAULT_OUTER_BACKGROUND = "#2f7b8b";
export const DEFAULT_INNER_BACKGROUND = "#08131f";

export function getDefaultThemePreferences(): ThemePreferences {
  return {
    outerBackgroundColor: DEFAULT_OUTER_BACKGROUND,
    innerBackgroundColor: DEFAULT_INNER_BACKGROUND,
  };
}

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeThemePreferences(
  value: Partial<ThemePreferences> | null | undefined,
): ThemePreferences {
  return {
    outerBackgroundColor:
      typeof value?.outerBackgroundColor === "string" && isHexColor(value.outerBackgroundColor)
        ? value.outerBackgroundColor
        : DEFAULT_OUTER_BACKGROUND,
    innerBackgroundColor:
      typeof value?.innerBackgroundColor === "string" && isHexColor(value.innerBackgroundColor)
        ? value.innerBackgroundColor
        : DEFAULT_INNER_BACKGROUND,
  };
}

export function parseThemePreferences(value: unknown): ThemePreferences | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Record<keyof ThemePreferences, unknown>>;

  if (
    typeof candidate.outerBackgroundColor !== "string" ||
    !isHexColor(candidate.outerBackgroundColor) ||
    typeof candidate.innerBackgroundColor !== "string" ||
    !isHexColor(candidate.innerBackgroundColor)
  ) {
    return null;
  }

  return {
    outerBackgroundColor: candidate.outerBackgroundColor,
    innerBackgroundColor: candidate.innerBackgroundColor,
  };
}

export function colorToRgb(color: string, fallbackColor: string) {
  const safeColor = isHexColor(color) ? color : fallbackColor;

  return {
    red: Number.parseInt(safeColor.slice(1, 3), 16),
    green: Number.parseInt(safeColor.slice(3, 5), 16),
    blue: Number.parseInt(safeColor.slice(5, 7), 16),
  };
}
