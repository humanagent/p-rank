import type { Metadata } from "next";
import { EnterFlow } from "@/components/flow/EnterFlow";

export const metadata: Metadata = { title: "Enter" };

export default function EnterPage() {
  return <EnterFlow />;
}
