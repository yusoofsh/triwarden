// @vitest-environment jsdom
import { createComponent, render } from 'solid-js/web';
import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: { runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } },
}));
vi.mock('../../lib/send', () => ({ send: vi.fn(async () => ({ ok: true, rows: [] })) }));
const { default: Overlay } = await import('./Overlay');
HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 200, 300, 40);
const tick = () => new Promise((r) => setTimeout(r, 0));

const keys = async (html: string) => {
  document.body.innerHTML = html;
  const host = document.createElement('div');
  document.body.append(host);
  const dispose = render(() => createComponent(Overlay, {}), host);
  await tick();
  const count = host.querySelectorAll('.key').length;
  dispose();
  return count;
};

it('leaves sign-up fields to the generate overlay and still offers vault fill on a login', async () => {
  expect(await keys(`<form><input name=user><input type=password name=pass><button type=submit>Sign up</button></form>`)).toBe(0);
  expect(await keys(`<form><input name=user><input type=password name=pass><button type=submit>Log in</button></form>`)).toBe(2);
});

describe('sign in by itself', () => {
  const run = async (rows: unknown[]) => {
    const { send } = await import('../../lib/send');
    vi.mocked(send).mockImplementation((async (req: { command: string }) =>
      req.command === 'match'
        ? { ok: true, rows }
        : { ok: true, username: 'me', password: 'secret', totp: undefined }) as never);
    sessionStorage.clear();
    document.body.innerHTML = `<form><input name=user><input type=password name=pass><button type=submit>Log in</button></form>`;
    const submitted = vi.fn((e: Event) => e.preventDefault());
    document.querySelector('form')!.addEventListener('submit', submitted);
    const host = document.createElement('div');
    document.body.append(host);
    const dispose = render(() => createComponent(Overlay, {}), host);
    await new Promise((r) => setTimeout(r, 1200));
    dispose();
    return { submitted, user: document.querySelector<HTMLInputElement>('[name=user]')!.value };
  };

  it('fills and submits when the site has exactly one login', async () => {
    const out = await run([{ id: '1', name: 'Site' }]);
    expect(out.user).toBe('me');
    expect(out.submitted).toHaveBeenCalledTimes(1);
  });

  it('leaves the choice to the person when there are several', async () => {
    const out = await run([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
    expect(out.user).toBe('');
    expect(out.submitted).not.toHaveBeenCalled();
  });
});
