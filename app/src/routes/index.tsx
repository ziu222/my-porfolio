import { createFileRoute } from "@tanstack/react-router";

import { NghiaPage } from "@/components/nghia/nghia-page";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <NghiaPage />;
}
