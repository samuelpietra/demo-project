import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInServerFn } from "@/lib/auth.server";
import { useIsDemoEnvironment } from "@/lib/config.client";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/" });
    }
  },
  component: SignInPage,
});

function SignInPage() {
  const router = useRouter();
  const showDemoAccounts = useIsDemoEnvironment();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const signIn = async (credentials: { email: string; password: string }) => {
    setError("");
    setIsLoading(true);
    try {
      const result = await signInServerFn({ data: credentials });
      if (result.success) {
        router.navigate({ to: "/" });
      } else {
        setError(result.error || "Sign in failed");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <img src="/wordmark.svg" alt="Logo" className="h-8 mx-auto" />
          <CardTitle className="text-2xl font-semibold text-gray-900">Sign in to your account</CardTitle>
          <p className="text-sm text-gray-500">Enter your credentials to continue</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link to="/create-account" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
          {showDemoAccounts && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts (development / test)</p>
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <div key={account.email} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{account.name}</p>
                      <p className="truncate text-xs text-slate-400">{account.description}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => signIn({ email: account.email, password: account.password })}>
                      Sign in
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
