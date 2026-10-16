// Interface language. English strings are the keys: t('Settings') returns the Spanish entry from app/src/i18n/es.js when
// the language is Spanish, else the key itself, so a missing entry still reads in English. {name} placeholders are filled
// from the second argument. setLang also switches the Bible book names (shared/books.js) and the page's lang attribute;
// the App remounts on a language change, so every component reads the new strings.
(function (SB) {
'use strict';
const { setLang: setBookLang } = SB.shared.books;
const LANGS = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }];
let lang = 'en';
const dict = () => (SB.i18n && SB.i18n[lang]) || null;
function t(key, vars) {
  const d = dict(); let s = d && d[key] != null ? d[key] : key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
function setLang(l) {
  lang = LANGS.some(x => x.id === l) ? l : 'en'; setBookLang(lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
const getLang = () => lang;
// Date and time formatting follows the interface language; English keeps the browser's own locale.
const locale = () => lang === 'es' ? 'es' : undefined;
// A block's caption word: kinds translate, a custom block's own label is the user's text.
function kindName(b) { const { kindLabel } = SB.shared.blocks; return b.kind === 'custom' ? kindLabel(b) : t(kindLabel(b)); }
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
(SB.lib ||= {}).i18n = { LANGS, t, setLang, getLang, locale, kindName, cap };
})(globalThis.SB ||= {});
