import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "tripbuddy-theme";

export function resolveInitialTheme(): Theme {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const documentTheme = document.documentElement.dataset.theme;
    return documentTheme === "light" || documentTheme === "dark"
      ? documentTheme
      : resolveInitialTheme();
  });
  const [followsSystemTheme, setFollowsSystemTheme] = useState(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme !== "light" && storedTheme !== "dark";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!followsSystemTheme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      return;
    }

    const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");

    if (!colorScheme) {
      return;
    }

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    colorScheme.addEventListener?.("change", handleSystemThemeChange);
    return () => colorScheme.removeEventListener?.("change", handleSystemThemeChange);
  }, [followsSystemTheme, theme]);

  const toggleTheme = useCallback(() => {
    setFollowsSystemTheme(false);
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }, []);

  return { theme, toggleTheme };
}
