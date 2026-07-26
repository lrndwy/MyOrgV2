import {
  ActivityIcon,
  BellIcon,
  Building2Icon,
  CalendarIcon,
  ClipboardListIcon,
  CloudIcon,
  DatabaseBackupIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LayoutPanelLeftIcon,
  MailIcon,
  MegaphoneIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import type { NavItem } from "@/lib/types"

export const memberNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon className="size-4" />,
  },
  {
    title: "Profil",
    url: "/profile",
    icon: <UserIcon className="size-4" />,
  },
  {
    title: "Event",
    url: "/events",
    icon: <CalendarIcon className="size-4" />,
    permission: "events.view",
  },
  {
    title: "Perizinan Saya",
    url: "/my-permissions",
    icon: <ClipboardListIcon className="size-4" />,
    permission: "permission.submit",
  },
  {
    title: "Pengumuman",
    url: "/announcements",
    icon: <MegaphoneIcon className="size-4" />,
  },
]

export const adminNavItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: <LayoutDashboardIcon className="size-4" />,
  },
  {
    title: "Pengaturan",
    url: "/admin/settings",
    icon: <SettingsIcon className="size-4" />,
    permission: "settings.manage",
  },
  {
    title: "Backup",
    url: "/admin/backup",
    icon: <DatabaseBackupIcon className="size-4" />,
    permission: "backup.manage",
  },
  {
    title: "Pengguna",
    url: "/admin/users",
    icon: <UsersIcon className="size-4" />,
    permission: "users.view",
  },
  {
    title: "Role & Akses",
    url: "/admin/roles",
    icon: <ShieldIcon className="size-4" />,
    permission: "roles.view",
  },
  {
    title: "Divisi",
    url: "/admin/divisions",
    icon: <Building2Icon className="size-4" />,
    permission: "divisions.view",
  },
  {
    title: "Event",
    url: "/admin/events",
    icon: <CalendarIcon className="size-4" />,
    permission: "events.view",
  },
  {
    title: "Approval Perizinan",
    url: "/admin/permissions",
    icon: <BellIcon className="size-4" />,
    permission: "attendance.approve",
  },
  {
    title: "Pelanggaran & SP",
    url: "/admin/violations",
    icon: <ClipboardListIcon className="size-4" />,
    permission: "violations.view",
  },
  {
    title: "Surat",
    url: "/admin/letters/incoming",
    icon: <MailIcon className="size-4" />,
    permission: "letters.view",
    items: [
      { title: "Surat Masuk", url: "/admin/letters/incoming" },
      { title: "Surat Keluar", url: "/admin/letters/outgoing" },
      { title: "Kategori Surat", url: "/admin/letters/categories", permission: "letters.manage" },
      { title: "Template Surat", url: "/admin/letters/templates", permission: "letters.manage" },
    ],
  },
  {
    title: "Pengumuman",
    url: "/admin/announcements",
    icon: <MegaphoneIcon className="size-4" />,
    permission: "announcement.create",
  },
  {
    title: "Keuangan",
    url: "/admin/finance",
    icon: <WalletIcon className="size-4" />,
    permission: "finance.view",
  },
  {
    title: "Penyimpanan Cloud",
    url: "/admin/storage",
    icon: <CloudIcon className="size-4" />,
    permission: "storage.view",
  },
  {
    title: "Log Aktivitas",
    url: "/admin/activity",
    icon: <ActivityIcon className="size-4" />,
    permission: "view.activity",
  },
]

export const adminSecondaryNav: NavItem[] = [
  {
    title: "Panel Anggota",
    url: "/dashboard",
    icon: <LayoutPanelLeftIcon className="size-4" />,
  },
]

export const memberSecondaryNav: NavItem[] = [
  {
    title: "Panel Admin",
    url: "/admin/dashboard",
    icon: <FileTextIcon className="size-4" />,
    permission: [
      "settings.manage",
      "users.view",
      "roles.view",
      "events.create",
      "letters.view",
      "finance.view",
      "storage.view",
      "backup.manage",
    ],
  },
]
