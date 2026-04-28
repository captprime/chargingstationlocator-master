"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeviceRegistrationSchema, type DeviceRegistrationFormData } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Car, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function DeviceRegistrationForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const form = useForm<DeviceRegistrationFormData>({
    resolver: zodResolver(DeviceRegistrationSchema),
    defaultValues: {
      vehicleId: "",
      deviceName: "",
    },
  });

  const onSubmit = async (data: DeviceRegistrationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Device registration failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Show success state
      setIsSuccess(true);
      toast.success("Device registered successfully!");

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error("Device registration error:", error);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Device Registered!</CardTitle>
            <CardDescription>
              Your EV device has been successfully linked to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Redirecting you to your dashboard...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Car className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Register Your EV Device</CardTitle>
          <CardDescription>
            Link your ESP32 device to start monitoring your battery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle ID</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="ESP32-ABC123"
                        disabled={isLoading}
                        {...field}
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter your ESP32 device ID (format: ESP32-XXX)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deviceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="My Tesla Model 3"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Give your device a friendly name for easy identification
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <div className="rounded-md bg-destructive/15 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Registering device..." : "Register Device"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              className="text-sm text-muted-foreground"
              onClick={() => router.push("/dashboard")}
              disabled={isLoading}
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}