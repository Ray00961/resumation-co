import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "ar" | "en";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  isRtl: boolean;
}

const LanguageContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
  isRtl: false,
});

function getInitialLang(): Lang {
  const stored = localStorage.getItem("app_lang");
  if (stored === "ar" || stored === "en") return stored;
  const pending = localStorage.getItem("pending_user_data");
  if (pending?.includes('"language":"ar"')) return "ar";
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("app_lang", l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  };

  // Sync dir on first mount
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, isRtl: lang === "ar" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
