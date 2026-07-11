import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/products")({
  component: ProductsLayout,
});

function ProductsLayout() {
  return <Outlet />;
}
