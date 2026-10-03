import type { ReactNode } from "react";

import type { ViewKey } from "../types";
import {
  IconGear,
  IconGrid,
  IconHelp,
  IconList,
  IconLogout,
  IconPin,
  IconTags,
} from "./Icons";

export interface SidebarUser {
  name: string;
  email: string;
  /** Optional photo; initials are shown when this is absent. */
  avatar?: string;
  initials: string;
}

const NAV: { key: ViewKey; label: string; icon: ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <IconGrid /> },
  { key: "vital", label: "Vital Task", icon: <IconPin /> },
  { key: "mine", label: "My Task", icon: <IconList /> },
  { key: "categories", label: "Task Categories", icon: <IconTags /> },
  { key: "settings", label: "Settings", icon: <IconGear /> },
  { key: "help", label: "Help", icon: <IconHelp /> },
];

interface SidebarProps {
  user: SidebarUser;
  active: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onLogout: () => void;
}

export function Sidebar({ user, active, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__profile">
        {user.avatar ? (
          <img className="sidebar__avatar" src={user.avatar} alt="" />
        ) : (
          <span className="sidebar__avatar sidebar__avatar--initials" aria-hidden="true">
            {user.initials}
          </span>
        )}
        <p className="sidebar__name">{user.name}</p>
        <p className="sidebar__email">{user.email}</p>
      </div>

      <nav className="sidebar__nav" aria-label="Sections">
        {NAV.map((item) => (
          <button
            key={item.key}
            type="button"
            className="nav-item"
            aria-current={active === item.key ? "page" : undefined}
            onClick={() => onNavigate(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button type="button" className="nav-item" onClick={onLogout}>
          <IconLogout />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
