"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setMessage(choice.outcome === "accepted" ? "Installed." : "Install dismissed.");
    setDeferred(null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
          <Smartphone size={16} />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-ink">
            {installed ? "Loonie is installed" : "Install Loonie"}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            {installed
              ? "Open it from your home screen for a full-screen, app-like view."
              : deferred
                ? "Add it to your home screen. The app shell works offline."
                : "On iPhone: Share → Add to Home Screen. On desktop Chrome, look for the install icon in the address bar."}
          </p>
          {message && <p className="mt-1 text-[10px] text-faint">{message}</p>}
        </div>
      </div>
      {deferred && !installed && (
        <button type="button" onClick={() => void install()} className="btn-secondary shrink-0">
          <Download size={14} /> Install app
        </button>
      )}
    </div>
  );
}
