import type { ReactNode } from "react";

/** Line icons drawn inline so the UI needs no icon library and no network. */
function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconGrid = () => (
  <Icon>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </Icon>
);

export const IconPin = () => (
  <Icon>
    <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
);

export const IconList = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconTags = () => (
  <Icon>
    <path d="M3 11.5V4.8A1.8 1.8 0 0 1 4.8 3h6.7a1.8 1.8 0 0 1 1.3.5l7.4 7.4a1.8 1.8 0 0 1 0 2.6l-6.7 6.7a1.8 1.8 0 0 1-2.6 0L3.5 12.8a1.8 1.8 0 0 1-.5-1.3Z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </Icon>
);

export const IconGear = () => (
  <Icon>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z" />
  </Icon>
);

export const IconHelp = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.1-2.4 3.5" />
    <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconLogout = () => (
  <Icon>
    <path d="M9 21H5.8A1.8 1.8 0 0 1 4 19.2V4.8A1.8 1.8 0 0 1 5.8 3H9" />
    <path d="M16 16.5 20.5 12 16 7.5" />
    <path d="M20.5 12H9" />
  </Icon>
);

export const IconSearch = () => (
  <Icon size={17}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

export const IconBell = () => (
  <Icon size={17}>
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </Icon>
);

export const IconApps = () => (
  <Icon size={17}>
    <circle cx="6" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="18" cy="18" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconPlus = () => (
  <Icon size={16}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconDots = () => (
  <Icon size={16}>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconCheck = () => (
  <Icon size={13}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
);

export const IconTrash = () => (
  <Icon size={15}>
    <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    <path d="M6.5 7 7.4 19a1.8 1.8 0 0 0 1.8 1.6h5.6a1.8 1.8 0 0 0 1.8-1.6L17.5 7" />
  </Icon>
);

export const IconClose = () => (
  <Icon size={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
