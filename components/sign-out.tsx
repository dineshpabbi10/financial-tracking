"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="text-paper/50 transition-colors hover:text-paper"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut size={17} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={className ?? "btn-secondary w-full"}
    >
      <LogOut size={15} />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
