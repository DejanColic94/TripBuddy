import { useTranslation } from "react-i18next";
import type { SupportedLanguage } from "../i18n";

const languageOptions: SupportedLanguage[] = ["en", "sr"];

function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const currentLanguage: SupportedLanguage = i18n.resolvedLanguage === "sr" ? "sr" : "en";

  return (
    <div className="language-toggle" role="group" aria-label={t("language.label")}>
      {languageOptions.map((language) => {
        const languageName = t(language === "en" ? "language.english" : "language.serbian");

        return (
          <button
            className={language === currentLanguage ? "is-active" : ""}
            type="button"
            key={language}
            aria-label={t("language.switchTo", { language: languageName })}
            aria-pressed={language === currentLanguage}
            onClick={() => void i18n.changeLanguage(language)}
          >
            {language.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageToggle;
