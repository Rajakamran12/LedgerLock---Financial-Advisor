import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono text-sm uppercase tracking-widest">
            LedgerLock
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" render={<Link href="/login">Log in</Link>} />
          <Button render={<Link href="/sign-up">Sign up</Link>} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
        <Badge className="border border-border bg-secondary font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Grounded Q&amp;A for financial documents
        </Badge>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          It only answers with what&apos;s on the page.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          Upload a 10-K, an annual report, or an earnings release. LedgerLock
          answers questions with citation-backed facts pulled directly from
          the document — and refuses, in code, anything it can&apos;t verify
          or that asks for investment advice.
        </p>
        <div className="flex items-center gap-3">
          <Button size="lg" render={<Link href="/sign-up">Get started</Link>} />
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/login">I already have an account</Link>}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Verified · p.47
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            Refused · Out of scope
          </span>
        </div>
      </main>
    </div>
  );
}
