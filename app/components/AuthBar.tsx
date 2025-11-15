"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChange, signInWithGoogle, signOut } from "@/app/lib/auth";

export default function AuthBar() {
  const [email, setEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const showBrand = pathname !== "/";
  useEffect(() => {
    const off = onAuthStateChange((s) => {
      setEmail(s?.user?.email ?? null);
    });
    return () => off();
  }, []);
  return (
    <div className={`flex items-center ${showBrand ? "justify-between" : "justify-end"} gap-2 text-sm`}>
      {showBrand && (
        <Link href="/" className="text-2xl text-zinc-50 hover:text-zinc-600">
          TrackNote
        </Link>
      )}
      <div className="flex items-center gap-2">
        {email ? (
          <>
            <span className="text-zinc-600">{email}</span>
            <button className="rounded-md border px-2 py-1 hover:bg-zinc-600" onClick={() => signOut()}>
              サインアウト
            </button>
          </>
        ) : (
          <button className="rounded-md border px-2 py-1 hover:bg-zinc-600" onClick={() => signInWithGoogle()}>
            Google でサインイン
          </button>
        )}
      </div>
    </div>
  );
}
