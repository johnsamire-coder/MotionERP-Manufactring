import { useEffect, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { directionOf } from '../i18n/config';

/**
 * Keeps the <html> element's `lang` and `dir` in sync with the active language
 * so the whole UI switches between LTR and RTL from a single place.
 */
function DocumentDirection(): null {
  const { i18n: instance } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = instance.language;
    document.documentElement.dir = directionOf(instance.language);
  }, [instance.language]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return (
    <I18nextProvider i18n={i18n}>
      <DocumentDirection />
      {children}
    </I18nextProvider>
  );
}
