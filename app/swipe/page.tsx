// app/swipe/page.tsx
import SwipeClient from "./page_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Page() {
  return <SwipeClient />;
}
