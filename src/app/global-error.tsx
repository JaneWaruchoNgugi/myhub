"use client";

/** Last-resort error page for failures above the app's own error boundaries (layouts). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f8fb", color: "#141834", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16 }}>
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>MYHUB couldn't load this page</h1>
          <p style={{ color: "#5d6385", fontSize: 14, margin: "0 0 20px" }}>
            Your data is safe. Try again in a moment. If it keeps happening, check the server logs{error.digest ? ` for reference ${error.digest}` : ""}.
          </p>
          <button onClick={reset} style={{ background: "#4338ca", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
