import {
  Home, Database, Package, Globe, ArrowUpDown,
  Users, ShoppingCart, TrendingUp, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  /** True when the link should only be "active" on an exact path match. */
  end?: boolean;
  /** True when the feature is not yet implemented — renders as non-navigable visual. */
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/',              icon: Home,         label: 'Home',   end: true },
  { to: '/toolkit',       icon: Database,     label: 'Toolkit'           },
  { to: '/pim/attributes',         icon: Package, label: 'PIM' },
  { to: '/gateway/endpoints',     icon: Globe,   label: 'API' },
  { to: '/import-export', icon: ArrowUpDown,  label: 'Import', disabled: true },
  { to: '/users',         icon: Users,        label: 'Users',  disabled: true },
  { to: '/ecommerce',     icon: ShoppingCart, label: 'Store',  disabled: true },
  { to: '/sales',         icon: TrendingUp,   label: 'Sales',  disabled: true },
];

/**
 * Bottom utility nav items (settings, etc.)
 */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { to: '/settings', icon: Settings, label: 'Settings', disabled: true },
];
