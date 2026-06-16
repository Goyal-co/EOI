import Link from "next/link";
import { Button } from "@goyal/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gold-light flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-hover text-white font-bold text-xl mx-auto mb-6 shadow-lg">
          G
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/customer/login">
            <Button variant="gold">Customer Login</Button>
          </Link>
          <Link href="/partner/login">
            <Button variant="outline">Partner Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
