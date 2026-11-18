import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Locale = "en" | "bn";

type LocaleContextValue = {
  locale: Locale;
  isBangla: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => (typeof window !== "undefined" && window.localStorage.getItem("atlas-locale") === "bn" ? "bn" : "en"));
  const value = useMemo(() => ({
    locale,
    isBangla: locale === "bn",
    setLocale: (next: Locale) => {
      setLocale(next);
      window.localStorage.setItem("atlas-locale", next);
      document.documentElement.lang = next === "bn" ? "bn" : "en";
    },
    toggleLocale: () => {
      const next = locale === "en" ? "bn" : "en";
      setLocale(next);
      window.localStorage.setItem("atlas-locale", next);
      document.documentElement.lang = next === "bn" ? "bn" : "en";
    },
  }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
