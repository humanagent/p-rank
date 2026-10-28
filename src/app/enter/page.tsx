import type { Metadata } from "next";
import { EnterFlow } from "@/components/flow/EnterFlow";

export const metadata: Metadata = { title: "Enter · Summer Invitational" };

export default function EnterPage() {
  return <EnterFlow />;
}
