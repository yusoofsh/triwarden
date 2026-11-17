// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  applyMenuDrag,
  generateMenuPlace,
  ICON_INSIDE_INSET,
  iconPosition,
  menuLeft,
  menuLeftNearIcon,
  menuVertical,
  menuVerticalGenerate,
  pinOverlayHost,
  pinToTopLayer,
} from './overlay-layout';

const field = { left: 100, right: 300, top: 40, height: 42 } as DOMRect;

describe('overlay placement', () => {
  it('places the icon inside the trailing edge of the field, vertically centred', () => {
    expect(iconPosition(field, false)).toMatchObject({ left: `${300 - 16 - ICON_INSIDE_INSET}px`, top: '53px' });
    expect(iconPosition(field, true)).toMatchObject({ left: `${100 + ICON_INSIDE_INSET}px`, top: '53px' });
  });

  it('steps past a control of the page that sits over the trailing edge', () => {
    // An eye button at 262–290 inside the 100–300 field: the 16px icon ends 10px before it.
    expect(iconPosition(field, false, undefined, [{ left: 262, right: 290 }]).left).toBe(`${262 - 10 - 16}px`);
    expect(iconPosition(field, true, undefined, [{ left: 110, right: 138 }]).left).toBe(`${138 + 10}px`);
    // A control far from the icon changes nothing.
    expect(iconPosition(field, false, undefined, [{ left: 120, right: 140 }]).left).toBe(`${300 - 16 - 8}px`);
  });

  it('keeps the icon on screen when the field runs past the viewport', () => {
    const past = { left: 100, right: 2000, top: 40, height: 42 } as DOMRect;
    expect(iconPosition(past, false, 1600).left).toBe(`${1600 - 16 - 8}px`);
    const before = { left: -300, right: 200, top: 40, height: 42 } as DOMRect;
    expect(iconPosition(before, true, 1600).left).toBe('8px');
  });

  it('aligns the menu to the field start in either direction', () => {
    const wideField = { left: 500, right: 800 };
    expect(menuLeft(wideField, 332, false, 1440)).toBe('500px');
    expect(menuLeft(wideField, 332, true, 1440)).toBe('468px');
  });

  it('keeps the menu inside the viewport', () => {
    expect(menuLeft({ left: -20, right: 100 }, 332, false, 800)).toBe('8px');
    expect(menuLeft({ left: 700, right: 900 }, 332, true, 800)).toBe('460px');
  });


  it('prefers the menu below the field when there is room', () => {
    const mid = { top: 400, bottom: 442 };
    expect(menuVertical(mid, 200, 900)).toEqual({ top: '448px', above: false });
  });

  it('falls back above when the space below is too tight', () => {
    const nearBottom = { top: 700, bottom: 742 };
    expect(menuVertical(nearBottom, 200, 800)).toEqual({ top: '494px', above: true });
  });
});

describe('generateMenuPlace', () => {
  const viewport = { width: 1200, height: 800 };
  const field = { left: 100, right: 400, top: 300, bottom: 340 };
  const confirm = { left: 100, right: 400, top: 360, bottom: 400 };

  it('sits above the new password when it fits, ending at the outside icon', () => {
    const p = generateMenuPlace(field, confirm, 280, 110, viewport, false);
    expect(p.vertical).toEqual({ top: `${300 - 6 - 110}px`, above: true });
    const iconLeft = 400 - 16 - ICON_INSIDE_INSET;
    expect(p.left).toBe(menuLeftNearIcon(iconLeft, 280, false, 1200));
  });

  it('anchors the menu to the icon after the viewport pulls that icon inward', () => {
    const narrow = { width: 500, height: 800 };
    const edge = { left: 400, right: 490, top: 300, bottom: 340 };
    const iconLeft = 490 - 16 - ICON_INSIDE_INSET;
    const p = generateMenuPlace(edge, null, 200, 110, narrow, false);
    expect(p.left).toBe(menuLeftNearIcon(iconLeft, 200, false, narrow.width));
  });

  it('goes below the confirm field, never over it, when there is no room above', () => {
    const high = { ...field, top: 40, bottom: 80 };
    const below = { ...confirm, top: 100, bottom: 140 };
    const p = generateMenuPlace(high, below, 280, 110, viewport, false);
    expect(p.vertical).toEqual({ top: `${140 + 6}px`, above: false });
  });

  it('stays inside the viewport', () => {
    const p = generateMenuPlace({ left: 0, right: 120, top: 300, bottom: 340 }, null, 280, 110, viewport, false);
    expect(p.left).toBe('8px');
  });

  it('menuVerticalGenerate matches generateMenuPlace vertical', () => {
    expect(menuVerticalGenerate(field, confirm, 110, 800)).toEqual({ top: '184px', above: true });
  });
});

describe('pinOverlayHost', () => {
  it('forces a viewport-sized host so absolute menus are not stuck at the origin', () => {
    const host = document.createElement('div');
    const box = document.createElement('div');
    // Simulate WXT's overlay defaults that Safari mishandles.
    host.style.position = 'relative';
    host.style.width = '0';
    host.style.height = '0';
    pinOverlayHost(host, box);
    expect(host.style.getPropertyValue('position')).toBe('fixed');
    expect(host.style.getPropertyPriority('position')).toBe('important');
    expect(host.style.getPropertyValue('pointer-events')).toBe('none');
    expect(host.style.getPropertyValue('top')).toBe('0px');
    expect(box.style.getPropertyValue('position')).toBe('absolute');
    expect(box.style.getPropertyValue('pointer-events')).toBe('none');
    expect(box.style.getPropertyPriority('top')).toBe('important');
  });
});

describe('applyMenuDrag', () => {
  const vp = { width: 1000, height: 800 };

  it('shifts from the anchored place by the drag delta', () => {
    expect(applyMenuDrag(100, 200, 40, -30, 300, 140, vp)).toEqual({ left: '140px', top: '170px' });
  });

  it('keeps the dragged menu inside the viewport', () => {
    expect(applyMenuDrag(100, 200, 900, 900, 300, 140, vp)).toEqual({ left: '692px', top: '652px' });
    expect(applyMenuDrag(100, 200, -500, -500, 300, 140, vp)).toEqual({ left: '8px', top: '8px' });
  });
});

describe('pinToTopLayer', () => {
  /** jsdom has no Popover API: a host that records show/hide stands in for it. */
  function fakeHost() {
    const host = document.createElement('div') as unknown as HTMLElement & { open: boolean };
    host.open = false;
    host.showPopover = vi.fn(() => void (host.open = true));
    host.hidePopover = vi.fn(() => void (host.open = false));
    host.matches = ((sel: string) => (sel === ':popover-open' ? host.open : false)) as typeof host.matches;
    return host;
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

  it('does nothing where the Popover API is missing', () => {
    const host = document.createElement('div');
    expect(() => pinToTopLayer(host)()).not.toThrow();
    expect(host.hasAttribute('popover')).toBe(false);
  });

  it('shows the host as a manual popover and raises it again when the page opens a popover or dialog', async () => {
    const host = fakeHost();
    const unpin = pinToTopLayer(host);
    expect(host.getAttribute('popover')).toBe('manual');
    expect(host.showPopover).toHaveBeenCalledTimes(1);

    const page = document.createElement('div');
    document.body.append(page);
    const toggle = new Event('toggle');
    Object.assign(toggle, { newState: 'open' });
    page.dispatchEvent(toggle); // toggle does not bubble but the listener is a capture one on document
    await frame();
    expect(host.hidePopover).toHaveBeenCalledTimes(1);
    expect(host.showPopover).toHaveBeenCalledTimes(2);

    const dialog = document.createElement('dialog');
    document.body.append(dialog);
    dialog.setAttribute('open', '');
    await new Promise((r) => setTimeout(r, 0));
    await frame();
    expect(host.showPopover).toHaveBeenCalledTimes(3);

    unpin();
    page.dispatchEvent(toggle);
    await frame();
    expect(host.showPopover).toHaveBeenCalledTimes(3);
  });

  it('ignores its own toggle', async () => {
    const host = fakeHost();
    document.body.append(host);
    const unpin = pinToTopLayer(host);
    const toggle = new Event('toggle');
    Object.assign(toggle, { newState: 'open' });
    host.dispatchEvent(toggle);
    await frame();
    expect(host.showPopover).toHaveBeenCalledTimes(1);
    unpin();
  });
});
