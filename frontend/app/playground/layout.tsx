/**
 * Playground layout - bypasses authentication for quick debugging
 */
export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
