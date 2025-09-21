import { cookies } from "next/headers";
import Client from "./page_client";
import OverlayMount from "../components/client/OverlayMount";

export default async function Page() {
  // Regler: alltid await cookies() i App Router (server-komponent)
  await cookies();

  return (
    <>
      <Client />
      {/* Monterar match-overlay globalt i swipe-sidan */}
      <OverlayMount />
    </>
  );
}
