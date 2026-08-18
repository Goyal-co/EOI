import { CustomerLayout } from "@/components/customer-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CustomerLayout>{children}</CustomerLayout>;
}
