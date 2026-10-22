import Link from "next/link";

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#f4f1e9",
        color: "#201d17",
        padding: "24px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          borderRadius: "24px",
          border: "1px solid #e3ddcf",
          background: "#fffdf8",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 12px 32px -24px rgba(32,29,23,.18)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "999px",
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(circle at 32% 26%, #f4dda5 0%, #d9ae5b 46%, #b8862d 100%)",
            color: "#123c2c",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "24px",
          }}
        >
          L
        </div>
        <h1
          style={{
            margin: "18px 0 0",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "28px",
            lineHeight: 1.15,
            color: "#0f3d2c",
          }}
        >
          You&apos;re offline.
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "13px",
            lineHeight: 1.65,
            color: "#746c5e",
          }}
        >
          Loonie doesn&apos;t cache your financial data for offline use — that&apos;s
          deliberate. Reconnect to your server to see your accounts and imports.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "22px",
            minHeight: "40px",
            padding: "0 18px",
            borderRadius: "999px",
            background: "#0f3d2c",
            color: "#f4f1e9",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Try again
        </Link>
        <p style={{ margin: "18px 0 0", fontSize: "10px", color: "#a39a8a" }}>
          Self-hosted · Single-user · Built for Canada
        </p>
      </div>
    </main>
  );
}
