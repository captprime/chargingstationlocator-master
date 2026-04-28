import { AddStationForm } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AddStationPage() {

    return (
        <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Add Charging Station
                        </h1>
                        <p className="text-muted-foreground">
                            Add a new charging station to the network
                        </p>
                    </div>
                </div>

            {/* Add Station Form */}
            <AddStationForm />
        </div>
    );
}