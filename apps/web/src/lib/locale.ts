export type SupportedLocale = 'cs' | 'en' | 'de';

const SUPPORTED_LOCALE_PREFIXES: readonly SupportedLocale[] = ['cs', 'en', 'de'];

const normalizeLocale = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const resolveSupportedLocaleFromValue = (value: string | null | undefined): SupportedLocale | null => {
  const normalized = normalizeLocale(value);

  if (!normalized) {
    return null;
  }

  const matched = SUPPORTED_LOCALE_PREFIXES.find(
    (locale) => normalized === locale || normalized.startsWith(`${locale}-`),
  );

  return matched ?? null;
};

export const resolveSupportedLocale = (fallback: SupportedLocale = 'en'): SupportedLocale => {
  if (typeof document !== 'undefined') {
    const fromHtml = resolveSupportedLocaleFromValue(document.documentElement.lang);

    if (fromHtml) {
      return fromHtml;
    }
  }

  if (typeof navigator !== 'undefined') {
    const fromNavigator = resolveSupportedLocaleFromValue(navigator.language);

    if (fromNavigator) {
      return fromNavigator;
    }
  }

  return fallback;
};
