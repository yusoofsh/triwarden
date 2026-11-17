// The toolbar popup: this site's logins (fill, copy username / password / code) and a password generator.
// It talks to the app the same way the background does; nothing here decides anything itself.
import { createResource, createSignal, For, Show } from 'solid-js';
import { browser } from 'wxt/browser';
import { replyErrorMessage } from '../../lib/bridge-status';
import { t } from '../../lib/i18n';
import type { Reply, Row } from '../../lib/protocol';

const HOST = 'io.github.sinhong2011.triwarden';

type Tab = { id: number; url: string | null };

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

export default function App() {
  const [state, { refetch }] = createResource(load);
  const [note, setNote] = createSignal('');
  let noteTimer: number | undefined;
  const say = (text: string) => {
    setNote(text);
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => setNote(''), 2200);
  };

  const fill = async (row: Row) => {
    const tab = state()?.tab;
    if (!tab) return;
    await browser.tabs.sendMessage(tab.id, { trigger: 'fill', row: row.id }).catch(() => {});
    window.close();
  };

  // Copying is the app's job: the value goes to the clipboard from there and never passes through the extension.
  const copy = async (row: Row, field: 'username' | 'password' | 'totp', label: string) => {
    const url = state()?.tab?.url;
    try {
      const reply = await native({ command: 'copy', query: row.id, field, url });
      say(reply?.ok ? label : replyErrorMessage(reply));
    } catch (error) {
      say(String((error as Error)?.message ?? error));
    }
  };

  // Generator
  const [passphrase, setPassphrase] = createSignal(false);
  const [generated, setGenerated] = createSignal('');
  const generate = async () => {
    try {
      const reply = await native({ command: 'generate', ...(passphrase() ? { field: 'passphrase' } : {}) });
      if (reply?.ok && reply.value) setGenerated(reply.value);
      else say(replyErrorMessage(reply));
    } catch (error) {
      say(String((error as Error)?.message ?? error));
    }
  };
  const copyGenerated = async () => {
    await navigator.clipboard.writeText(generated());
    say(t('popup.copied'));
  };

  const host = () => {
    const url = state()?.tab?.url;
    try {
      return url ? new URL(url).hostname : '';
    } catch {
      return '';
    }
  };

  return (
    <main>
      <header>
        <h1>{t('extName')}</h1>
        <span class="site">{host()}</span>
        <button type="button" class="ghost" title={t('popup.refresh')} aria-label={t('popup.refresh')} on:click={() => void refetch()}>
          ↻
        </button>
      </header>

      <section>
        <Show when={!state.loading} fallback={<p class="muted">{t('overlay.lookingForLogins')}</p>}>
          <Show when={!state()?.problem} fallback={<p class="problem">{state()!.problem}</p>}>
            <Show when={state()?.tab?.url} fallback={<p class="muted">{t('popup.notHere')}</p>}>
              <Show when={state()!.rows.length} fallback={<p class="muted">{t('overlay.noLogins')}</p>}>
                <ul>
                  <For each={state()!.rows}>
                    {(row, i) => (
                      <li classList={{ best: !!row.exact }}>
                        <div class="head">
                          <span class="fav" aria-hidden="true">
                            <Show when={row.icon} fallback={(row.name[0] ?? '?').toUpperCase()}>
                              <img src={`data:image/png;base64,${row.icon}`} alt="" width="20" height="20" />
                            </Show>
                          </span>
                        <div class="who">
                          <span class="name">{row.name}</span>
                          <Show when={row.detail}>
                            <span class="detail">{row.detail}</span>
                          </Show>
                        </div>
                        </div>
                        <div class="acts">
                          <button type="button" class="primary" autofocus={i() === 0} on:click={() => void fill(row)}>
                            {t('popup.fill')}
                          </button>
                          <button type="button" on:click={() => void copy(row, 'username', t('popup.copiedUsername'))}>
                            {t('popup.username')}
                          </button>
                          <button type="button" on:click={() => void copy(row, 'password', t('popup.copiedPassword'))}>
                            {t('popup.password')}
                          </button>
                          <Show when={row.totpPeriod}>
                            <button type="button" on:click={() => void copy(row, 'totp', t('popup.copiedCode'))}>
                              {t('popup.code')}
                            </button>
                          </Show>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Show>
          </Show>
        </Show>
      </section>

      <section class="gen">
        <div class="gen-head">
          <h2>{t('popup.generator')}</h2>
          <label>
            <input
              type="checkbox"
              checked={passphrase()}
              on:change={(e) => {
                setPassphrase(e.currentTarget.checked);
                setGenerated('');
              }}
            />
            {t('popup.passphrase')}
          </label>
        </div>
        <Show
          when={generated()}
          fallback={
            <button type="button" class="primary wide" on:click={() => void generate()}>
              {t('popup.generate')}
            </button>
          }
        >
          <code>{generated()}</code>
          <div class="acts">
            <button type="button" class="primary" on:click={() => void copyGenerated()}>
              {t('popup.copy')}
            </button>
            <button type="button" on:click={() => void generate()}>
              {t('popup.again')}
            </button>
          </div>
        </Show>
      </section>

      <Show when={note()}>
        <p class="note" role="status">
          {note()}
        </p>
      </Show>
    </main>
  );
}
