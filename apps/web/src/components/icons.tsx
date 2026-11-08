import type { SVGProps } from 'react';
import type { TypeCode } from '../api';

/** small inline icon set (24px grid, stroke icons) so the app ships no icon font */
function Icon({ children, size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

export const TruckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 7h10v8H3zM13 10h4l3 3v2h-7" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
  </Icon>
);

export const ExcavatorIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 17h10M4 14h7v3H4zM11 14l4-7 4 3-2 3" />
    <path d="M17 13l1 3h-3" />
    <circle cx="5.5" cy="19" r="1" />
    <circle cx="11" cy="19" r="1" />
  </Icon>
);

export const DrillIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 3h6v4H9zM12 7v10M10 11h4M10 14h4M12 17l-1.5 4h3z" />
  </Icon>
);

export const LoaderIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 16h9v-5H6l-3 3zM12 13h3l2-4h-2" />
    <path d="M17 9l4 2-1 5h-3" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="12" cy="18" r="2" />
  </Icon>
);

/** shown for a type this build does not know yet (for example, one added by a newer migration) */
export const GenericEquipmentIcon = (p: P) => (
  <Icon {...p}>
    <rect x="4" y="7" width="16" height="10" rx="2" />
    <path d="M8 7V5h8v2" />
    <circle cx="8" cy="19" r="1.5" />
    <circle cx="16" cy="19" r="1.5" />
  </Icon>
);

export const typeIcon: Record<TypeCode, (p: P) => React.JSX.Element> = {
  CAMION: TruckIcon,
  EXCAVADORA: ExcavatorIcon,
  PERFORADORA: DrillIcon,
  CARGADOR: LoaderIcon,
};

/**
 * Icon for any type code coming from the API. The database can be ahead of this bundle, so an
 * unknown code must render a generic icon instead of an undefined component (which crashes React).
 */
export function iconFor(code: string): (p: P) => React.JSX.Element {
  return Object.hasOwn(typeIcon, code) ? typeIcon[code as TypeCode] : GenericEquipmentIcon;
}

export const GridIcon = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const WrenchIcon = (p: P) => (
  <Icon {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" />
  </Icon>
);

export const AlertIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Icon>
);

export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Icon>
);

export const PlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const EditIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Icon>
);

export const TrashIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Icon>
);

export const SearchIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const LogoutIcon = (p: P) => (
  <Icon {...p}>
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </Icon>
);

export const EyeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.3-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);

export const CloseIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/** brand mark: a stylized haul truck */
export const BrandMark = () => (
  <span className="brand-mark">
    <TruckIcon size={20} />
  </span>
);
