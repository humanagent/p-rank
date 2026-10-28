import type { Metadata } from "next";

export const metadata: Metadata = { title: "Club desk" };

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
