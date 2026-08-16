import { useState } from "react";
import { Link, useLocation } from "wouter";
import { PublicLayout } from "@/components/layout";
import { Button, Input, Card } from "@/components/ui/shared";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function useSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function ResetPasswordPage() {
  const token = useSearchParam("token");
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setStatus("error");
      setMessage("No reset token found. Please request a new reset link.");
      return;
    }
    try {
      setIsPending(true);
      setMessage(null);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error || "Something went wrong. Please try again.");
      } else {
        setStatus("success");
        setMessage(json.message);
        // Redirect to login after a short delay
        setTimeout(() => setLocation("/login"), 3000);
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  };

  const invalidToken = !token;

  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="p-8 backdrop-blur-xl bg-card/90">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-display font-bold text-foreground">Reset Password</h1>
              <p className="text-muted-foreground mt-2">Choose a new password for your account.</p>
            </div>

            {status === "success" && message && (
              <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm">{message}</p>
                  <p className="text-sm mt-1 opacity-75">Redirecting to login…</p>
                </div>
              </div>
            )}

            {(status === "error" || invalidToken) && (
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  {message ||
                    "No reset token found. Please request a new password reset link."}
                </p>
              </div>
            )}

            {status !== "success" && !invalidToken && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground ml-1">New Password</label>
                  <Input
                    {...register("password")}
                    type="password"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-destructive text-sm ml-1">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground ml-1">
                    Confirm New Password
                  </label>
                  <Input
                    {...register("confirmPassword")}
                    type="password"
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-destructive text-sm ml-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full mt-4" disabled={isPending}>
                  {isPending ? "Updating..." : "Set New Password"}
                </Button>
              </form>
            )}

            {(invalidToken || status === "error") && (
              <div className="mt-4 text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Request a new reset link
                </Link>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
