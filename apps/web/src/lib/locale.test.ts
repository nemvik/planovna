import { resolveSupportedLocaleFromValue } from './locale';

describe('resolveSupportedLocaleFromValue', () => {
  it('resolves simple locale values', () => {
    expect(resolveSupportedLocaleFromValue('cs')).toBe('cs');
    expect(resolveSupportedLocaleFromValue('en-GB')).toBe('en');
    expect(resolveSupportedLocaleFromValue('de-DE')).toBe('de');
  });

  it('resolves Accept-Language headers with quality values', () => {
    expect(resolveSupportedLocaleFromValue('de;q=0.8,en;q=0.7')).toBe('de');
    expect(resolveSupportedLocaleFromValue('fr-FR,cs;q=0.9,en;q=0.8')).toBe('cs');
  });

  it('returns null for unsupported locales', () => {
    expect(resolveSupportedLocaleFromValue('fr-FR')).toBeNull();
    expect(resolveSupportedLocaleFromValue('')).toBeNull();
    expect(resolveSupportedLocaleFromValue(undefined)).toBeNull();
  });
});
