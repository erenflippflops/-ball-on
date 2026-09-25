import { useState, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { translations } from './translations';
import type { Language, TranslationKey } from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider(props: I18nProviderProps) {
  const [language, setLanguage] = useState<Language>('tr');

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const value = { language, setLanguage, t };

  return I18nContext.Provider({ value, children: props.children });
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
