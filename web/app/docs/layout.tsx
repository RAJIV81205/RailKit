import DocsLayoutShell from "../../components/docs/DocsLayoutShell";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsLayoutShell>{children}</DocsLayoutShell>;
}
