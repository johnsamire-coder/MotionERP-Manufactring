import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import i18n from './app/i18n/config';
import { AppProviders } from './app/providers/AppProviders';

function renderApp(): void {
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('App shell', () => {
  it('renders the localized name in English and sets LTR direction', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Motion ERP' })).toBeInTheDocument();
    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches to Arabic and flips the document direction to RTL', async () => {
    renderApp();

    await userEvent.selectOptions(screen.getByRole('combobox'), 'ar');

    expect(await screen.findByRole('heading', { name: 'موشن ERP' })).toBeInTheDocument();
    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });
});
