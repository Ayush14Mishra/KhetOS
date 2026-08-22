"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("KhetOS recovered a screen error", error);
  }, [error]);

  const recover = () => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("gramin-connect:") && (key.includes("/api/") || key.includes("auction-list"))) {
        localStorage.removeItem(key);
      }
    }
    if (typeof reset === "function") {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <main className="recovery-screen">
      <div>
        <strong>KhetOS</strong>
        <h1>Something went wrong while loading the field desk.</h1>
        <p>
          Your farmer profile is safe. Clear temporary field cache and reload the application.
        </p>
        <button onClick={recover}>Reload field data</button>
      </div>
    </main>
  );
}
