import {
  Activity,
  Bell,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Tab, View } from "@/types/care";

type NavItem = {
  id: Tab;
  icon: ReactNode;
  label: string;
  count?: number;
  alertCount?: boolean;
};
type Props = {
  view: View;
  tab: Tab;
  pendingCount: number;
  alertCount: number;
  mobileOpen: boolean;
  onNavigate: (tab: Tab) => void;
  onCloseMobile: () => void;
  onReset: () => void;
};

const navigationItems = (
  pendingCount: number,
  alertCount: number,
): NavItem[] => [
  { id: "overview", icon: <LayoutDashboard size={18} />, label: "Overview" },
  {
    id: "care-plans",
    icon: <ClipboardList size={18} />,
    label: "Care plans",
    count: pendingCount,
  },
  {
    id: "alerts",
    icon: <Bell size={18} />,
    label: "Alerts",
    count: alertCount,
    alertCount: true,
  },
  { id: "timeline", icon: <Activity size={18} />, label: "Timeline" },
];

function Navigation({
  items,
  view,
  tab,
  onNavigate,
}: {
  items: NavItem[];
  view: View;
  tab: Tab;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <>
      <div className="workspace-label">Workspace</div>
      <nav className="nav-list">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === "doctor" && tab === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon} {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span
                className={`nav-count ${item.alertCount ? "alert-count" : ""}`}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </>
  );
}
function Footer({ onReset }: { onReset: () => void }) {
  return (
    <div className="sidebar-bottom">
      <button className="reset-btn" onClick={onReset}>
        <RotateCcw size={16} /> Reset workspace
      </button>
      <div className="support-card">
        <ShieldCheck size={18} />
        <div>
          <strong>Care data protected</strong>
          <span>Private clinical workspace</span>
        </div>
      </div>
      <button className="nav-item">
        <LogOut size={18} /> Sign out
      </button>
    </div>
  );
}
export function AppSidebar({
  view,
  tab,
  pendingCount,
  alertCount,
  mobileOpen,
  onNavigate,
  onCloseMobile,
  onReset,
}: Props) {
  const items = navigationItems(pendingCount, alertCount);
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse size={22} />
          </div>
          <div>
            <strong>pulsepath</strong>
            <span>remote care</span>
          </div>
        </div>
        <Navigation
          items={items}
          view={view}
          tab={tab}
          onNavigate={onNavigate}
        />
        <Footer onReset={onReset} />
      </aside>
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onCloseMobile} />
      )}
      <aside className={`sidebar mobile ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse size={22} />
          </div>
          <div>
            <strong>pulsepath</strong>
            <span>remote care</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <Navigation
          items={items}
          view={view}
          tab={tab}
          onNavigate={onNavigate}
        />
        <Footer onReset={onReset} />
      </aside>
    </>
  );
}
