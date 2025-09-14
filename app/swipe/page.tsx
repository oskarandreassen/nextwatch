// app/swipe/page.tsx
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LegacySwipe from "./_legacy";

export const dynamic = "force-dynamic";

export default async function SwipePage() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value;
  if (!uid) redirect("/auth/signup");

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { emailVerified: true },
  });

  const isVerified = !!user?.emailVerified;

  const profile = await prisma.profile.findUnique({
    where: { userId: uid },
    select: { userId: true },
  });

  const hasProfile = !!profile;
  if (!isVerified || !hasProfile) {
    redirect("/onboarding");
  }

  return <LegacySwipe />;
}
