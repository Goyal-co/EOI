import Link from "next/link";
import { Button, brand } from "@goyal/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gold-light flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <img
          src={brand.logoSrc}
          alt="Goyal Hariyana"
          className="mx-auto mb-6 h-12 w-auto max-w-[260px] object-contain"
        />
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
