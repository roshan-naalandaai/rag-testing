import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          {/* Logo mark */}
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">N</span>
            </div>
            <span className="font-semibold text-sm tracking-tight">Naalanda</span>
          </div>

          <span className="text-border">|</span>
          <span className="text-sm text-muted-foreground">Whiteboard Lesson Generator</span>
        </div>
      </header>

      <Component {...pageProps} />
    </div>
  );
}
