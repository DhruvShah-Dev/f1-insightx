import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | F1 InsightX",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  redirect("/account");
}
