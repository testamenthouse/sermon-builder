import { html } from './lib/html.js';
import { useEffect } from 'react';
import { useStore, set, boot, saveNow, closeMenus, get, toggleBible, toggleIll, closeLibFind, toggleDictation, stopDictation } from './store.js';
import { Gate, Blocked, GitHubLink } from './ui/Gate.js';
import { supported } from './lib/dictation.js';
import { Library } from './ui/Library.js';
import { Sermon } from './ui/Sermon.js';
import { Illustrations } from './ui/Illustrations.js';
import { Templates } from './ui/Templates.js';
import { Podium } from './ui/Podium.js';
import { Confirm, SermonModal, CollectionModal, PrintMenu, Settings, NameDialog, KindColors, Alert, DictationBar, DictationStop } from './ui/Overlays.js';

export function App() {
  const { booting, folderOpen, screen, podium } = useStore(s => ({ booting: s.booting, folderOpen: s.folderOpen, screen: s.screen, podium: s.podium }));
  useEffect(() => { if (supported()) boot(); }, []);
  useEffect(() => { if (podium || screen !== 'sermon') stopDictation(); }, [podium, screen]);
  useEffect(() => {
    const onKey = e => {
      const s = get(); if (!s.folderOpen) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') { if (s.podium) return; if (s.alert) set({ alert: null }); else if (s.confirm) set({ confirm: null }); else if (s.kindMenu) set({ kindMenu: null }); else if (s.findOpen) set({ findOpen: false }); else if ((s.screen === 'library' || s.screen === 'templates') && (s.libFindOpen || s.libQuery)) closeLibFind(); else closeMenus(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
      if ((s.screen === 'library' || s.screen === 'templates') && mod && e.key.toLowerCase() === 'f') { e.preventDefault(); set({ libFindOpen: true }); }
      if (s.screen !== 'sermon' || s.podium) return;
      if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); set({ findOpen: true, findIdx: 0 }); }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); if (e.shiftKey) set({ podium: true }); else set({ printMenu: true }); }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBible(); }
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); toggleIll(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); toggleDictation(); }
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!supported()) return html`<${Blocked} />`;
  if (booting) return null;
  if (!folderOpen) return html`<${Gate} />`;
  return html`<>
    ${screen === 'sermon' ? html`<${Sermon} />` : screen === 'illustrations' ? html`<${Illustrations} />` : screen === 'templates' ? html`<${Templates} />` : html`<${Library} />`}
    ${podium && html`<${Podium} />`}
    ${!podium && (screen === 'library' || screen === 'templates') && html`<${GitHubLink} />`}
    <${SermonModal} /><${CollectionModal} /><${PrintMenu} /><${Settings} /><${KindColors} /><${NameDialog} /><${Confirm} /><${Alert} /><${DictationBar} /><${DictationStop} />
  </>`;
}
