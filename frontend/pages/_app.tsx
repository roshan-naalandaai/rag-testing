import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Link from "next/link";
import { useRouter } from "next/router";

const NAV_LINKS = [
  { href: "/", label: "Generator" },
  { href: "/knowledge-graph", label: "KG" },
  { href: "/user-graph", label: "User Graph" },
];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
            <span className="text-sm font-semibold tracking-wide">RAG Tutoring</span>
          </div>
          <div className="flex items-center gap-2">
            {NAV_LINKS.map((link) => {
              const active = router.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    active
                      ? "border-blue-500 text-blue-200 bg-blue-950/40"
                      : "border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <Component {...pageProps} />
    </div>
  );
}
