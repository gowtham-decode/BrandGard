import { createFileRoute } from "@tanstack/react-router";
import { BrandGuardApp } from "@/components/brandguard-app";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/auth")({
  head: () => pageHead("Sign in", "Sign in to analyze suspicious brand impersonation submissions."),
  component: BrandGuardApp,
});
