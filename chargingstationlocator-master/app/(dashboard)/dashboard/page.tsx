import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import Link from "next/link";
import { BatteryMonitor } from "@/components/battery/battery-monitor";
import { ActiveSessionsCard } from "@/components/sessions/active-sessions-card";
import { DashboardTools } from "@/components/dashboard/dashboard-tools";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Battery, MapPin, History, BarChart2, ChevronRight, Crown, Leaf } from "lucide-react";
import connectDB from "@/lib/mongodb";
import UserDevice from "@/models/UserDevice";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  await connectDB();

  const userDevice = await UserDevice.findOne({
    userId: new mongoose.Types.ObjectId(session.user.id),
  });
  const vehicleId = userDevice ? userDevice.vehicleId : null;

  const quickActions = [
    {
      href: "/battery-dashboard",
      icon: Battery,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      label: "Battery Dashboard",
      desc: "Real-time voltage, current & alerts",
    },
    {
      href: "/stations",
      icon: MapPin,
      color: "text-blue-600",
      bg: "bg-blue-50",
      label: "Charging Stations",
      desc: "Find nearby charging points",
    },
    {
      href: "/history",
      icon: BarChart2,
      color: "text-violet-600",
      bg: "bg-violet-50",
      label: "Battery Analytics",
      desc: "Historical voltage & power data",
    },    {
      href: "/plans",
      icon: Crown,
      color: "text-amber-600",
      bg: "bg-amber-50",
      label: "Subscription Plans",
      desc: "Priority charging & discounts",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session.user.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s an overview of your EV status.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {quickActions.map(({ href, icon: Icon, color, bg, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`${bg} p-3 rounded-lg flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground truncate">{desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Battery Monitor */}
        <div className="lg:col-span-2">
          <BatteryMonitor className="w-full" vehicleId={vehicleId} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Active Sessions */}
          <ActiveSessionsCard />

          {/* Account Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{session.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{session.user.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicle ID</span>
                <span className="font-medium truncate max-w-[120px]">
                  {vehicleId ?? "Not registered"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Battery Tips */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Battery Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { dot: "bg-green-500", title: "Optimal Range", tip: "Keep between 20–80% for longevity" },
                { dot: "bg-yellow-500", title: "Low Battery", tip: "Charge when voltage drops below 48V" },
                { dot: "bg-red-500", title: "Critical Level", tip: "Find charging immediately below 45V" },
              ].map(({ dot, title, tip }) => (
                <div key={title} className="flex items-start gap-2">
                  <div className={`w-2 h-2 ${dot} rounded-full mt-1.5 flex-shrink-0`} />
                  <div>
                    <div className="font-medium">{title}</div>
                    <div className="text-xs text-muted-foreground">{tip}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Route Predictor + Carbon Savings */}
      <DashboardTools />
    </div>
  );
}
