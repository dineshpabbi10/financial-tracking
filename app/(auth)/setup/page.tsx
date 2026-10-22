import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession, isSetupComplete } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Set up" };

export default async function SetupPage() {
  if (await getSession()) redirect("/");
  if (await isSetupComplete()) redirect("/login");
  return <AuthForm mode="setup" />;
}
