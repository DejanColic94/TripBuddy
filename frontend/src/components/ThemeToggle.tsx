import { useTranslation } from "react-i18next";
import type { Theme } from "../hooks/useTheme";

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const nextTheme = t(isDark ? "theme.light" : "theme.dark");

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={t("theme.switchTo", { theme: nextTheme.toLocaleLowerCase() })}
      aria-pressed={isDark}
      onClick={onToggle}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
        </svg>
      )}
      <span>{nextTheme}</span>
    </button>
  );
}

export default ThemeToggle;
