import { createFileRoute } from "@tanstack/react-router";
import { BrandGuardApp } from "@/components/brandguard-app";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Dashboard",
      "Register verified brand assets and analyze suspicious social profiles and app listings.",
    ),
  component: BrandGuardApp,
});
