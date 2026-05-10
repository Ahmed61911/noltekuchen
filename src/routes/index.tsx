import { createFileRoute, redirect } from "@tanstack/react-router";

// Index simply redirects into the protected app shell
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
