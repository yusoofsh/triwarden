// The toolbar popup: a browser-sized subset of the Triwarden menu bar panel (App/Sources/MenuBarExtraView.swift).
// Same cards, capsule tabs, colour-coded generator and strength meter. It talks to the app the way the background
// does; the extension decides nothing and never holds a secret beyond the generator's own suggestion.
import { createEffect, createResource, createSignal, For, onCleanup, Show } from 'solid-js';
import { browser } from 'wxt/browser';
import { replyErrorMessage } from '../../lib/bridge-status';
import { t } from '../../lib/i18n';
import type { Reply, Row } from '../../lib/protocol';

const HOST = 'io.github.sinhong2011.triwarden';

type Tab = { id: number; url: string | null };
type View = 'logins' | 'codes';

async function activeTab(): Promise<Tab | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return null;
  let url: string | null = null;
  try {
    // Asked of the page itself, as the right-click menu does: no `tabs` permission needed.
    const answer = await browser.tabs.sendMessage(tab.id, { ask: 'url' }, { frameId: 0 });
    if (typeof answer === 'string' && /^https?:/.test(answer)) url = answer;
  } catch {
    // Browser pages, the web store, a tab still loading: no content script there.
  }
  return { id: tab.id, url };
}

const native = async (message: Record<string, unknown>) =>
  (await Promise.resolve(browser.runtime.sendNativeMessage(HOST, message))) as Reply | undefined;

type State = { tab: Tab | null; rows: Row[]; problem: string };

async function load(): Promise<State> {
  const tab = await activeTab();
  if (!tab?.url) return { tab, rows: [], problem: '' };
  try {
    const reply = await native({ command: 'match', url: tab.url, silent: true });
    if (reply?.ok) return { tab, rows: reply.rows ?? [], problem: '' };
    return { tab, rows: [], problem: replyErrorMessage(reply) };
  } catch (error) {
    return { tab, rows: [], problem: String((error as Error)?.message ?? error) };
  }
}

const Icon = (props: { path: string }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={props.path} />
  </svg>
);
const P = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  key: 'M14 10a4 4 0 1 1-3.5 2L4 18.5V21h2.5v-2H9v-2.5h2L12 15.5',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
};

/** Letters plain, digits blue, symbols red: the app's ColoredSecret. */
const ColoredSecret = (props: { value: string }) => (
  <code class="secret">
    <For each={[...props.value]}>
      {(c) => <span class={/\d/.test(c) ? 'd' : /[A-Za-z]/.test(c) ? 'l' : 's'}>{c}</span>}
    </For>
  </code>
);

/** Four bars, filled by entropy; the app's StrengthMeter. */
function strength(bits: number | undefined) {
  const b = bits ?? 0;
  const level = b >= 90 ? 4 : b >= 64 ? 3 : b >= 40 ? 2 : b > 0 ? 1 : 0;
  return { level, label: [t('popup.s0'), t('popup.s1'), t('popup.s2'), t('popup.s3'), t('popup.s4')][level]! };
}

/** The ring that drains over a code's period. */
const Ring = (props: { remaining: number; period: number }) => {
  const r = 11;
  const c = 2 * Math.PI * r;
  return (
    <svg class="ring" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--edge)" stroke-width="2.5" />
      <circle
        cx="14"
        cy="14"
        r={r}
        fill="none"
        stroke={props.remaining <= 5 ? 'var(--warn)' : 'var(--brand)'}
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-dasharray={String(c)}
        stroke-dashoffset={String(c * (1 - props.remaining / props.period))}
        transform="rotate(-90 14 14)"
      />
      <text x="14" y="17.5" text-anchor="middle">{props.remaining}</text>
    </svg>
  );
};

const Fav = (props: { row: Row }) => (
  <span class="fav" aria-hidden="true">
    <Show when={props.row.icon} fallback={(props.row.name[0] ?? '?').toUpperCase()}>
      <img src={`data:image/png;base64,${props.row.icon}`} alt="" width="24" height="24" />
    </Show>
  </span>
);

export default function App() {
  const [state, { refetch }] = createResource(load);
  const [view, setView] = createSignal<View>('logins');
  const [note, setNote] = createSignal('');
  let noteTimer: number | undefined;
  const say = (text: string) => {
    setNote(text);
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => setNote(''), 2200);
  };
  const fail = (error: unknown) => say(String((error as Error)?.message ?? error));

  const url = () => state()?.tab?.url ?? undefined;
  const host = () => {
    try {
      return url() ? new URL(url()!).hostname.replace(/^www\./, '') : '';
    } catch {
      return '';
    }
  };

  const fill = async (row: Row) => {
    const tab = state()?.tab;
    if (!tab) return;
    await browser.tabs.sendMessage(tab.id, { trigger: 'fill', row: row.id }).catch(() => {});
    window.close();
  };

  // Copying is the app's job: the value goes to the clipboard from there and never passes through the extension.
  const copy = async (row: Row, field: 'username' | 'password' | 'totp', label: string) => {
    try {
      const reply = await native({ command: 'copy', query: row.id, field, url: url() });
      say(reply?.ok ? label : replyErrorMessage(reply));
    } catch (error) {
      fail(error);
    }
  };

  // ---- Codes: asked for on purpose (the app approves it), then kept fresh by the clock.
  const [codes, setCodes] = createSignal<Row[] | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const loadCodes = async () => {
    if (!url()) return;
    try {
      const reply = await native({ command: 'match', url: url(), codes: true, reveal: true, foreground: true });
      if (reply?.ok) setCodes((reply.rows ?? []).filter((r) => r.totpPeriod));
      else say(replyErrorMessage(reply));
    } catch (error) {
      fail(error);
    }
  };
  createEffect(() => {
    if (view() !== 'codes') return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    onCleanup(() => clearInterval(timer));
  });
  const remaining = (period: number) => period - (Math.floor(now() / 1000) % period);
  // A code rolls over: ask again (the app approved this site a moment ago).
  let lastSlice = new Map<string, number>();
  createEffect(() => {
    const list = codes();
    if (!list || view() !== 'codes') return;
    for (const row of list) {
      const slice = Math.floor(now() / 1000 / row.totpPeriod!);
      const seen = lastSlice.get(row.id);
      if (seen == null) lastSlice.set(row.id, slice);
      else if (seen !== slice) {
        lastSlice = new Map();
        void loadCodes();
        break;
      }
    }
  });
  const spaced = (code: string) => (code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code);

  // ---- Generator
  const [passphrase, setPassphrase] = createSignal(false);
  const [generated, setGenerated] = createSignal('');
  const [bits, setBits] = createSignal<number | undefined>();
  const generate = async () => {
    try {
      const reply = await native({ command: 'generate', ...(passphrase() ? { field: 'passphrase' } : {}) });
      if (reply?.ok && reply.value) {
        setGenerated(reply.value);
        setBits(reply.entropyBits);
      } else say(replyErrorMessage(reply));
    } catch (error) {
      fail(error);
    }
  };
  createEffect(() => {
    passphrase();
    void generate();
  });
  // Sign in by itself when a site has exactly one login (stored locally; the content script reads it).
  const [auto, setAuto] = createSignal(true);
  void browser.storage.local.get('autoSignIn').then((v) => setAuto(v.autoSignIn !== false));
  const toggleAuto = (on: boolean) => {
    setAuto(on);
    void browser.storage.local.set({ autoSignIn: on });
  };
  const copyGenerated = async () => {
    await navigator.clipboard.writeText(generated());
    say(t('popup.copied'));
  };

  return (
    <main>
      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view() === 'logins'} classList={{ on: view() === 'logins' }} on:click={() => setView('logins')}>
          {t('popup.tabLogins')}
        </button>
        <button type="button" role="tab" aria-selected={view() === 'codes'} classList={{ on: view() === 'codes' }} on:click={() => setView('codes')}>
          {t('popup.tabCodes')}
        </button>
        <button type="button" class="round" title={t('popup.refresh')} aria-label={t('popup.refresh')} on:click={() => { setCodes(null); void refetch(); }}>
          <Icon path={P.refresh} />
        </button>
      </div>

      <section class="card">
        <div class="cap">
          <span class="capname">{host() ? t('popup.forSite', host()) : t('extName')}</span>
          <Show when={view() === 'logins' && state()?.rows.length}>
            <span class="capnote">{t('popup.clickToFill')}</span>
          </Show>
        </div>

        <Show when={!state.loading} fallback={<p class="empty">{t('overlay.lookingForLogins')}</p>}>
          <Show when={!state()?.problem} fallback={<p class="empty problem">{state()!.problem}</p>}>
            <Show when={url()} fallback={<p class="empty">{t('popup.notHere')}</p>}>
              <Show when={view() === 'logins'}>
                <Show when={state()!.rows.length} fallback={<p class="empty">{t('overlay.noLogins')}</p>}>
                  <ul>
                    <For each={state()!.rows}>
                      {(row, i) => (
                        <li>
                          <button type="button" class="row" autofocus={i() === 0} on:click={() => void fill(row)}>
                            <Fav row={row} />
                            <span class="who">
                              <span class="name">{row.name}</span>
                              <Show when={row.detail}>
                                <span class="detail">{row.detail}</span>
                              </Show>
                            </span>
                          </button>
                          <span class="mini">
                            <button type="button" class="round sm" title={t('popup.copyUsername')} aria-label={t('popup.copyUsername')} on:click={() => void copy(row, 'username', t('popup.copiedUsername'))}>
                              <Icon path={P.user} />
                            </button>
                            <button type="button" class="round sm" title={t('popup.copyPassword')} aria-label={t('popup.copyPassword')} on:click={() => void copy(row, 'password', t('popup.copiedPassword'))}>
                              <Icon path={P.key} />
                            </button>
                          </span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </Show>

              <Show when={view() === 'codes'}>
                <Show
                  when={codes()}
                  fallback={
                    <div class="empty">
                      <p>{t('popup.codesHint')}</p>
                      <button type="button" class="pill" on:click={() => void loadCodes()}>
                        <Icon path={P.lock} /> {t('popup.showCodes')}
                      </button>
                    </div>
                  }
                >
                  <Show when={codes()!.length} fallback={<p class="empty">{t('overlay.noLoginHasCode')}</p>}>
                    <ul>
                      <For each={codes()!}>
                        {(row) => (
                          <li>
                            <button type="button" class="row" on:click={() => void copy(row, 'totp', t('popup.copiedCode'))}>
                              <Fav row={row} />
                              <span class="who">
                                <span class="name">{row.name}</span>
                                <span class="detail">{row.detail}</span>
                              </span>
                              <span class="otp">{row.code ? spaced(row.code) : '••• •••'}</span>
                              <Ring remaining={remaining(row.totpPeriod!)} period={row.totpPeriod!} />
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </Show>
              </Show>
            </Show>
          </Show>
        </Show>
      </section>

      <section class="card gen">
        <div class="genhead">
          <h2>{t('popup.generator')}</h2>
          <div class="seg" role="group" aria-label={t('popup.generator')}>
            <button type="button" classList={{ on: !passphrase() }} on:click={() => setPassphrase(false)}>
              {t('popup.password')}
            </button>
            <button type="button" classList={{ on: passphrase() }} on:click={() => setPassphrase(true)}>
              {t('popup.passphrase')}
            </button>
          </div>
        </div>
        <ColoredSecret value={generated()} />
        <div class="genfoot">
          <div class="meter" role="img" aria-label={strength(bits()).label}>
            <For each={[1, 2, 3, 4]}>{(n) => <i classList={{ fill: n <= strength(bits()).level }} />}</For>
            <span>{strength(bits()).label}</span>
          </div>
          <button type="button" class="round" title={t('popup.again')} aria-label={t('popup.again')} on:click={() => void generate()}>
            <Icon path={P.refresh} />
          </button>
          <button type="button" class="round" title={t('popup.copy')} aria-label={t('popup.copy')} on:click={() => void copyGenerated()}>
            <Icon path={P.copy} />
          </button>
        </div>
      </section>

      <label class="auto">
        <input type="checkbox" checked={auto()} on:change={(e) => toggleAuto(e.currentTarget.checked)} />
        <span>{t('popup.autoSignIn')}</span>
      </label>

      <Show when={note()}>
        <p class="note" role="status">
          {note()}
        </p>
      </Show>
    </main>
  );
}
