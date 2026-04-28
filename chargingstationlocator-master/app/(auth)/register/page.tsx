import { SignUpForm } from "@/components/auth/signup-form";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(session.user.role === 'admin' ? '/admin/dashboard' : '/dashboard');
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUpForm />
    </div>
  );
}