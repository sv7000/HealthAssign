import { ArrowUpRight, Bell, Menu, Moon, Sun } from "lucide-react";
import type { Tab, View } from "@/types/care";

type Props = {
  view: View;
  tab: Tab;
  theme: "light" | "dark";
  alertCount: number;
  onOpenMenu: () => void;
  onToggleTheme: () => void;
};
export function AppHeader({
  view,
  tab,
  theme,
  alertCount,
  onOpenMenu,
  onToggleTheme,
}: Props) {
  const label =
    view === "patient"
      ? "Patient view"
      : tab === "overview"
        ? "Patient monitoring"
        : tab === "care-plans"
          ? "Care plans"
          : tab === "alerts"
            ? "Alerts"
            : "Timeline";
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu-btn"
          onClick={onOpenMenu}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <span>Workspace</span>
        <ArrowUpRight size={14} />
        <strong>{label}</strong>
      </div>
      <div className="top-actions">
        <div className="status-pill">
          <span className="status-dot" /> All systems healthy
        </div>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          {theme === "light" ? "Dark" : "Light"}
        </button>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={18} />
          {alertCount > 0 && <i />}
        </button>
        <div className="profile-chip">
          <div className="mini-avatar">ER</div>
          <span>Elena Ruiz</span>
          <strong>ER</strong>
        </div>
      </div>
    </header>
  );
}
