import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminNavigation } from "@/components/admin/admin-navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Check if user is authenticated
  if (!session) {
    redirect("/login");
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNavigation session={session} />
      <main>{children}</main>
    </div>
  );
}