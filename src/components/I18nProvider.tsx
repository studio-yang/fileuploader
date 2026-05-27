'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import zhTW from '../../messages/zh-TW.json';
import en   from '../../messages/en.json';

export type Locale = 'zh-TW' | 'en';

const ALL_MESSAGES: Record<Locale, typeof zhTW> = { 'zh-TW': zhTW, 'en': en };

interface LocaleCtx { locale: Locale; setLocale: (l: Locale) => void; }
const LocaleContext = createContext<LocaleCtx>({ locale: 'zh-TW', setLocale: () => {} });

export function useLocale() { return useContext(LocaleContext); }

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-TW');

  useEffect(() => {
    const saved = localStorage.getItem('fl:locale') as Locale | null;
    if (saved === 'zh-TW' || saved === 'en') setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('fl:locale', l);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={ALL_MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
