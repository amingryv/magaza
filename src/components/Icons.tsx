// The icon set drawn for the Moxen layout: one stroke weight, round joins.
type P = { size?: number; className?: string; strokeWidth?: number };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  className,
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconBack = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.3}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);
export const IconBag = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.8}>
    <path d="M6.6 7.8h10.8a1 1 0 0 1 1 .9l1 10.3a1.8 1.8 0 0 1-1.8 2H6.4a1.8 1.8 0 0 1-1.8-2l1-10.3a1 1 0 0 1 1-.9zM9 11.2V6.8a3 3 0 0 1 6 0v4.4" />
  </svg>
);
export const IconHeart = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </svg>
);
export const IconHome = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <path d="M4.5 11 12 4.5l7.5 6.5v8a1.2 1.2 0 0 1-1.2 1.2H15v-5.2H9v5.2H5.7a1.2 1.2 0 0 1-1.2-1.2z" />
  </svg>
);
export const IconSearch = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <circle cx="11" cy="11" r="6.2" />
    <path d="m16 16 4 4" />
  </svg>
);
export const IconGrid = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <rect x="4.5" y="4.5" width="6.2" height="6.2" rx="2" />
    <rect x="13.3" y="4.5" width="6.2" height="6.2" rx="3.1" />
    <rect x="4.5" y="13.3" width="6.2" height="6.2" rx="3.1" />
    <rect x="13.3" y="13.3" width="6.2" height="6.2" rx="2" />
  </svg>
);
export const IconPin = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <path d="M12 20.5s-6.5-5.6-6.5-10.6a6.5 6.5 0 0 1 13 0c0 5-6.5 10.6-6.5 10.6z" />
    <circle cx="12" cy="9.9" r="2.3" />
  </svg>
);
export const IconClock = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <circle cx="12" cy="12" r="7.8" />
    <path d="M12 7.8V12l2.8 1.8" />
  </svg>
);
export const IconMinus = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.3}>
    <path d="M6 12h12" />
  </svg>
);
export const IconPlus = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.3}>
    <path d="M12 6v12M6 12h12" />
  </svg>
);
export const IconCheck = ({ size = 22, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.6}>
    <path d="m5.5 12.5 4.3 4.3 8.7-9.3" />
  </svg>
);
export const IconClose = ({ size = 20, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.2}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
);
export const IconArrow = ({ size = 20, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.2}>
    <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />
  </svg>
);
export const IconFilter = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2}>
    <path d="M4.5 7h15M7.5 12h9M10.5 17h3" />
  </svg>
);
export const IconTrash = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <path d="M5.5 7.5h13M9.5 7.5V5.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M7.2 7.5l.8 11a1.6 1.6 0 0 0 1.6 1.5h4.8a1.6 1.6 0 0 0 1.6-1.5l.8-11" />
  </svg>
);
export const IconSun = ({ size = 20, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6 6l1.3 1.3M16.7 16.7 18 18M6 18l1.3-1.3M16.7 7.3 18 6" />
  </svg>
);
export const IconMoon = ({ size = 20, className }: P) => (
  <svg {...base(size, className)} strokeWidth={1.9}>
    <path d="M19 14.6A7.5 7.5 0 0 1 9.4 5a7.5 7.5 0 1 0 9.6 9.6z" />
  </svg>
);
export const IconLock = ({ size = 15, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2}>
    <rect x="5.5" y="10.5" width="13" height="9" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);
