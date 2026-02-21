"use client";

import { GuideHeader } from "@/components/layout/GuideHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LifeBuoy, BookOpen, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HelpPage() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <GuideHeader
                breadcrumbs={[
                    { label: "My Universe", href: "/app" },
                    { label: "Help & Support" }
                ]}
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <BookOpen className="h-8 w-8 text-indigo-500 mb-2" />
                        <CardTitle>Documentation</CardTitle>
                        <CardDescription>Explore comprehensive guides and API references for the ONPro platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="w-full">View Guides (Coming Soon)</Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <MessageSquare className="h-8 w-8 text-emerald-500 mb-2" />
                        <CardTitle>Contact Support</CardTitle>
                        <CardDescription>Need direct assistance? Our compliance engineering team is here to help.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full" onClick={() => window.location.href = "mailto:support@onpro.com"}>Email Support</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
