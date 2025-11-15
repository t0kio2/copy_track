"use client";

import { useEffect, useState } from "react";
import { onAuthStateChange, signInWithGoogle, signOut } from "@/app/lib/auth";

export default function AuthBar() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const off = onAuthStateChange((s) => {
      setEmail(s?.user?.email ?? null);
    });
    return () => off();
  }, []);
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      {email ? (
        <>
          <span className="text-zinc-600">{email}</span>
          <button className="rounded-md border px-2 py-1 hover:bg-zinc-50" onClick={() => signOut()}>
            サインアウト
          </button>
        </>
      ) : (
        <button className="rounded-md border px-2 py-1 hover:bg-zinc-50" onClick={() => signInWithGoogle()}>
          Google でサインイン
        </button>
      )}
    </div>
  );
}
