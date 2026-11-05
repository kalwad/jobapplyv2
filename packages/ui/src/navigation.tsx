import type { ReactNode } from "react";

export interface NavigationItem<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly href: string;
  readonly icon?: ReactNode;
}

export interface PrimaryNavigationProps<Id extends string> {
  readonly items: readonly NavigationItem<Id>[];
  readonly currentId: Id;
  readonly label?: string;
}

/** Native links preserve familiar Tab, open-link, and history behavior. */
export function PrimaryNavigation<Id extends string>({
  items,
  currentId,
  label = "Primary",
}: PrimaryNavigationProps<Id>) {
  return (
    <nav aria-label={label} className="ui-navigation">
      <ul className="ui-navigation__list">
        {items.map(({ id, href, label: itemLabel, icon }) => (
          <li key={id}>
            <a
              className="ui-navigation__link"
              href={href}
              aria-current={id === currentId ? "page" : undefined}
            >
              {icon === undefined ? null : (
                <span className="ui-navigation__icon" aria-hidden="true">
                  {icon}
                </span>
              )}
              <span>{itemLabel}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface SkipLinkProps {
  readonly targetId: string;
  readonly children?: ReactNode;
}

export function SkipLink({
  targetId,
  children = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a
      className="ui-skip-link"
      href={`#${targetId}`}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (target !== null) {
          event.preventDefault();
          target.focus();
        }
      }}
    >
      {children}
    </a>
  );
}
