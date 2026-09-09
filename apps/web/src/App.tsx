import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, directionOf } from './app/i18n/config';

export function App(): JSX.Element {
  const { t, i18n } = useTranslation();

  return (
    <main className="app-shell">
      <h1 className="app-shell__title">{t('app.name')}</h1>
      <p className="app-shell__tagline">{t('app.tagline')}</p>
      <p className="app-shell__status">{t('app.shellReady')}</p>
      <p className="app-shell__note">{t('app.foundationOnly')}</p>

      <label className="app-shell__control">
        <span>{t('app.language')}</span>
        <select
          aria-label={t('app.language')}
          value={i18n.language}
          onChange={(event) => {
            void i18n.changeLanguage(event.target.value);
          }}
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {t(`app.languageName.${language}`)}
            </option>
          ))}
        </select>
      </label>

      <p className="app-shell__control">
        <span>{t('app.direction')}:</span>
        <strong data-testid="direction">{directionOf(i18n.language)}</strong>
      </p>
    </main>
  );
}
