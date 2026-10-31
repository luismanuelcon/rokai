import { ExpandableNav, type ExpandableNavItem } from './ExpandableNav';
import { Icon } from './Icon';

export interface NavRailItem<T extends string> {
  value: T;
  icon: string;
  label: string;
}

/**
 * Acción principal fija junto a la navegación expandible del equipo.
 */
export function NavRail<T extends string>({
  label,
  items,
  cta,
  active,
  onSelect,
}: {
  label: string;
  items: NavRailItem<T>[];
  cta?: NavRailItem<T>;
  active: T;
  onSelect: (value: T) => void;
}) {
  const navItems: ExpandableNavItem<T>[] = items.map((item) => ({
    value: item.value,
    icon: item.icon,
    label: item.label,
  }));

  return (
    <div className="navrail">
      {cta && (
        <button
          type="button"
          className="navrail-cta"
          aria-current={active === cta.value ? 'page' : undefined}
          onClick={() => {
            onSelect(cta.value);
          }}
        >
          <Icon name={cta.icon} />
          {cta.label}
        </button>
      )}
      <ExpandableNav
        className="xnav-team"
        label={label}
        items={navItems}
        active={active}
        onSelect={onSelect}
      />
    </div>
  );
}
