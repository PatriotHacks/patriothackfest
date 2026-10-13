export default function CardLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-white p-4 sm:p-6">
      {children}
    </main>
  )
}
