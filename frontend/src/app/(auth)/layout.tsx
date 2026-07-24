export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mb-8 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          LedgerLock
        </span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
