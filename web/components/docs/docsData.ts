// Docs navigation is shared by the sidebar, route generation, and sitemap.
import {
  AlertTriangle,
  Armchair,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle,
  CircleX,
  Gamepad2,
  History,
  IndianRupee,
  MapPin,
  Package,
  Rocket,
  Search,
  Ticket,
  Train,
  type LucideIcon,
} from "lucide-react";

export type SidebarItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  children?: SidebarItem[];
};

export type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

export const sidebarGroups: SidebarGroup[] = [
  {
    title: "Getting Started",
    items: [
      { id: "introduction", label: "Introduction", icon: BookOpen },
      { id: "installation", label: "Installation", icon: Package },
      { id: "quickstart", label: "Quick Start", icon: Rocket },
    ],
  },
  {
    title: "Core Features",
    items: [
      { id: "pnr-status", label: "PNR Status", icon: Ticket },
      { id: "train-info", label: "Train Information", icon: Train },
      {
        id: "track-train",
        label: "Track Train",
        icon: MapPin,
        children: [
          { id: "live-tracking", label: "V1 · NTES", icon: MapPin },
          { id: "live-tracking-v2", label: "V2 · WIMT", icon: MapPin, badge: "NEW" },
        ],
      },
      { id: "train-history", label: "Train History", icon: History },
      { id: "station-live", label: "Live at Station", icon: Building2 },
      { id: "station-timetable", label: "Station Timetable", icon: Building2, badge: "NEW" },
      { id: "train-search", label: "Train Search", icon: Search },
      { id: "seat-availability", label: "Seat Availability", icon: Armchair },
      { id: "fare-lookup", label: "Fare Lookup", icon: IndianRupee },
      { id: "cancelled-trains", label: "Cancelled Trains", icon: CircleX },
    ],
  },
  {
    title: "Lookup",
    items: [
      { id: "station-by-code", label: "Station Lookup", icon: MapPin, badge: "NEW" },
      { id: "station-search", label: "Station Search", icon: Search, badge: "NEW" },
      { id: "train-by-number", label: "Train Lookup", icon: Train, badge: "NEW" },
      { id: "train-name-search", label: "Train Search by Name", icon: Search, badge: "NEW" },
    ],
  },
  { title: "Tools", items: [{ id: "playground", label: "Playground", icon: Gamepad2 }] },
  {
    title: "Reference",
    items: [
      { id: "validation", label: "Input Validation", icon: CheckCircle },
      { id: "status-codes", label: "Status Codes", icon: BarChart3 },
      { id: "errors", label: "Error Handling", icon: AlertTriangle },
    ],
  },
];

// Every section below has a matching rendered section in DocsPage.
export const sections: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "introduction", label: "Introduction", icon: BookOpen },
  { id: "installation", label: "Installation", icon: Package },
  { id: "quickstart", label: "Quick Start", icon: Rocket },
  { id: "pnr-status", label: "PNR Status", icon: Ticket },
  { id: "train-info", label: "Train Information", icon: Train },
  { id: "live-tracking", label: "Track Train — V1 NTES", icon: MapPin },
  { id: "live-tracking-v2", label: "Track Train — V2 WIMT", icon: MapPin },
  { id: "train-history", label: "Train History", icon: History },
  { id: "station-live", label: "Live at Station", icon: Building2 },
  { id: "train-search", label: "Train Search", icon: Search },
  { id: "seat-availability", label: "Seat Availability", icon: Armchair },
  { id: "fare-lookup", label: "Fare Lookup", icon: IndianRupee },
  { id: "cancelled-trains", label: "Cancelled Trains", icon: CircleX },
  { id: "station-by-code", label: "Station Lookup", icon: MapPin },
  { id: "station-search", label: "Station Search", icon: Search },
  { id: "train-by-number", label: "Train Lookup", icon: Train },
  { id: "train-name-search", label: "Train Search by Name", icon: Search },
  { id: "station-timetable", label: "Station Timetable", icon: Building2 },
  { id: "playground", label: "Playground", icon: Gamepad2 },
  { id: "validation", label: "Input Validation", icon: CheckCircle },
  { id: "status-codes", label: "Status Codes", icon: BarChart3 },
  { id: "errors", label: "Error Handling", icon: AlertTriangle },
];
