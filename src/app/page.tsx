"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function Home() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMessage() {
      try {
        const response = await fetch(`${apiUrl}/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        const body = await response.text();
        setMessage(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    loadMessage();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 rounded-3xl border border-black/5 bg-white p-10 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <div>
            <h1 className="text-3xl font-semibold text-black dark:text-white">Frontend connected</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Backend URL: <span className="font-medium">{apiUrl}</span>
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-black/10 bg-zinc-100 p-6 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Backend response
          </p>
          <div className="mt-4 min-h-[4rem] text-lg text-zinc-900 dark:text-white">
            {isLoading && "Loading from backend..."}
            {error && <span className="text-rose-600">Error: {error}</span>}
            {message && <span>{message}</span>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-left shadow-sm transition hover:border-black/20 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className="text-lg font-semibold text-black dark:text-white">Next.js docs</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Learn how to build better React apps with Next.js.</p>
          </a>

          <a
            className="rounded-2xl border border-black/10 bg-white px-5 py-4 text-left shadow-sm transition hover:border-black/20 hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
            href="https://nestjs.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className="text-lg font-semibold text-black dark:text-white">NestJS docs</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Check the backend framework docs for API and routing help.</p>
          </a>
        </div>
      </main>
    </div>
  );
}
