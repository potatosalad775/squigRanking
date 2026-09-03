// Light/dark theme. The stored choice wins; otherwise the OS preference is
// followed, and keeps being followed until the user picks a side.

const STORAGE_KEY = 'preferred-theme';

export type Theme = 'light' | 'dark';

function read(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function write(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage blocked; the choice lasts for this page view only */
  }
}

function systemTheme(): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setupTheme(button: HTMLElement | null): void {
  const stored = read();
  apply(stored ?? systemTheme());

  if (!stored) {
    // No explicit choice yet, so track the OS as it changes.
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', event => {
      if (!read()) apply(event.matches ? 'dark' : 'light');
    });
  }

  button?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    apply(next);
    write(next);
  });
}
