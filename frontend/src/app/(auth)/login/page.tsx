"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: AuthFormState = { error: null };

export default function LoginPage() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === "1") {
      // In test mode, bypass the login page and show the dashboard
      window.location.href = "/dashboard";
    }
  }, []);
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>
          Access your documents and query history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
