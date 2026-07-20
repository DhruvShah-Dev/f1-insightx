import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { makeMetadata } from "@/lib/seo";

export const metadata: Metadata = makeMetadata({
  title: "Profile",
  description: "F1 InsightX profile redirect.",
  path: "/profile",
  index: false,
});

export default async function ProfilePage() {
  redirect("/account");
}
