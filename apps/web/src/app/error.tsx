"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, brand } from "@goyal/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gold-light flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <img
          src={brand.logoSrc}
          alt="Goyal Hariyana"
          className="mx-auto mb-6 h-12 w-auto max-w-[260px] object-contain"
        />
        <h1 className="text-3xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-8">
          An unexpected error occurred. Please try again or return to the login page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="gold" onClick={reset}>Try again</Button>
          <Link href="/customer/login">
            <Button variant="outline">Go to login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
