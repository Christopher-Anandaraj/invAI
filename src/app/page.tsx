"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <div className="bg-zinc-900 p-8 rounded-xl shadow-lg flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold mb-2">Bot Verification</h1>
        <p className="text-lg text-zinc-300 mb-4">Please verify you are human to access my investment dashboard.</p>
        <button
          className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          onClick={() => router.push("/dashboard")}
        >
          I am not a bot
        </button>
      </div>
    </div>
  );
}
