import { AppShell } from '@/components/shell/app-shell';

/** Every authenticated route lives inside AppShell — this layout never recreates the shell,
 * it only mounts it once per the App Router's layout-nesting model
 * (docs/interaction-framework/01-application-shell.md). */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
