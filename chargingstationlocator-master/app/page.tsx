import Link from 'next/link';
import {
  Battery,
  MapPin,
  BarChart2,
  Bell,
  Smartphone,
  Zap,
  Shield,
  Activity,
  Navigation,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Battery,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    title: 'Real-Time Battery Monitoring',
    desc: 'Track voltage, current, and power consumption live from your ESP32 device. Automatic 10-second polling keeps your data fresh.',
  },
  {
    icon: MapPin,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    title: 'Nearby Charging Stations',
    desc: 'Find EV charging stations near you on an interactive map or list view. Filter by radius and see live queue lengths.',
  },
  {
    icon: BarChart2,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    title: 'Battery Analytics',
    desc: 'Historical voltage, current, and power charts across day, week, or month. Spot trends and understand your battery health over time.',
  },
  {
    icon: Bell,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    title: 'Low Battery Alerts',
    desc: 'Get in-app notifications the moment your battery drops below your custom threshold. Never get stranded with a dead battery.',
  },
  {
    icon: Smartphone,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    title: 'SMS Notifications',
    desc: 'Receive SMS alerts with nearby charging station links when your battery is low. Verified phone number required.',
  },
  {
    icon: Activity,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    title: 'Current & Power Tracking',
    desc: 'Monitor charging and discharging current in real time. See instantaneous power draw and efficiency metrics.',
  },
  {
    icon: Navigation,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    title: 'Queue Management',
    desc: 'See live queue lengths at each charging station via WebSocket updates. Join a queue and track your session.',
  },
  {
    icon: Shield,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    title: 'Secure & Role-Based',
    desc: 'User and admin roles with NextAuth. Admins can add and manage charging stations from a dedicated panel.',
  },
  {
    icon: Zap,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    title: 'ESP32 Device Integration',
    desc: 'Register your ESP32 hardware device by vehicle ID. The app automatically pulls live readings from your device.',
  },
];

const stats = [
  { value: 'Live', label: 'Real-time data' },
  { value: '10s', label: 'Polling interval' },
  { value: 'SMS', label: 'Alert delivery' },
  { value: '100km', label: 'Station search radius' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Battery className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">ChargeSense</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 bg-gradient-to-b from-emerald-50 to-white">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-1 rounded-full mb-6">
          <Zap className="h-3 w-3" />
          Smart EV Battery Management
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 max-w-3xl leading-tight">
          Monitor your EV battery.{' '}
          <span className="text-emerald-600">Never get stranded.</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl">
          Real-time battery monitoring, nearby charging station finder, and smart alerts — all in one dashboard powered by your ESP32 device.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Link href="/register">
              Start for free
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in to dashboard</Link>
          </Button>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Everything you need</h2>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            From live sensor data to SMS alerts, ChargeSense covers the full EV monitoring workflow.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, color, bg, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow"
            >
              <div className={`${bg} w-10 h-10 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-t py-20 px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Get started in minutes</h2>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Create an account', desc: 'Sign up with your email and set up your profile.' },
            { step: '2', title: 'Register your device', desc: 'Link your ESP32 device using its vehicle ID.' },
            { step: '3', title: 'Monitor & get alerts', desc: 'View live data and configure battery alert thresholds.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                {step}
              </div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-3xl font-bold text-gray-900">Ready to take control?</h2>
          <p className="text-gray-500">Join ChargeSense and keep your EV running with confidence.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" asChild className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Link href="/register">
                Create free account
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-400">
            {['No credit card required', 'Free to use', 'ESP32 compatible'].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600">
              <Battery className="h-3 w-3 text-white" />
            </div>
            <span className="font-medium text-gray-600">ChargeSense</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-gray-600 transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-gray-600 transition-colors">Register</Link>
            <Link href="/dashboard" className="hover:text-gray-600 transition-colors">Dashboard</Link>
          </div>
          <span>© {new Date().getFullYear()} ChargeSense</span>
        </div>
      </footer>
    </div>
  );
}
