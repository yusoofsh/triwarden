import { createUniqueId } from 'solid-js';

/**
 * The middle of the Triwarden app icon: the dial face with its three rings and the keyhole, without the blue tile or
 * the outer plate (Design/AppIcon/AppIcon.svg). Small and round, so it can sit inside the trailing edge of a field.
 */
// Each mark gets its own gradient ids: marks sharing ids break once the first one is display:none (hidden until its
// field has focus), and every later mark then loses its fills.
export const AppMark = (props: { size: number }) => {
  const uid = createUniqueId();
  const id = (name: string) => `tw-${name}-${uid}`;
  return (
  <svg viewBox="168 168 688 688" width={props.size} height={props.size} aria-hidden="true">
    <defs>
      <linearGradient id={id('face')} x1="0" y1="168" x2="0" y2="856" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FFFFFF" />
        <stop offset="1" stop-color="#DDEEFA" />
      </linearGradient>
      <linearGradient id={id('r1')} x1="0" y1="242" x2="0" y2="782" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#A9DAF7" />
        <stop offset="1" stop-color="#6DBBEB" />
      </linearGradient>
      <linearGradient id={id('r2')} x1="0" y1="310" x2="0" y2="714" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#4AA8E4" />
        <stop offset="1" stop-color="#2283C9" />
      </linearGradient>
      <linearGradient id={id('r3')} x1="0" y1="378" x2="0" y2="646" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#1670AE" />
        <stop offset="1" stop-color="#0A4E80" />
      </linearGradient>
    </defs>
    <circle cx="512" cy="512" r="344" fill={`url(#${id(\'face\')})`} />
    <circle cx="512" cy="512" r="338" fill="none" stroke="#0B2A40" stroke-opacity=".16" stroke-width="12" />
    <path d="M477.0 779.7 A270 270 0 1 1 547.0 779.7" fill="none" stroke-width="40" stroke-linecap="round" stroke={`url(#${id(\'r1\')})`} />
    <path d="M477.0 710.9 A202 202 0 1 1 547.0 710.9" fill="none" stroke-width="40" stroke-linecap="round" stroke={`url(#${id(\'r2\')})`} />
    <path d="M477.0 641.3 A134 134 0 1 1 547.0 641.3" fill="none" stroke-width="40" stroke-linecap="round" stroke={`url(#${id(\'r3\')})`} />
    <circle cx="512" cy="488" r="46" fill={`url(#${id(\'r3\')})`} />
    <path d="M494 500 L530 500 L540 592 Q541 604 529 604 L495 604 Q483 604 484 592 Z" fill={`url(#${id(\'r3\')})`} />
  </svg>
  );
};
