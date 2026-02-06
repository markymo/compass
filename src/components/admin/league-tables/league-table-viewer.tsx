"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LeagueStats {
    rank: number | string;
    volume: number;
    count: number;
    share: number;
}

interface BankEntry {
    id: string;
    name: string;
    stats: LeagueStats;
}

interface LeagueTableViewerProps {
    ukList: BankEntry[];
    euList: BankEntry[];
}

export function LeagueTableViewer({ ukList, euList }: LeagueTableViewerProps) {

    function LeagueTable({ data, currency }: { data: BankEntry[], currency: string }) {
        if (data.length === 0) {
            return <div className="p-8 text-center text-slate-500">No data available.</div>;
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">Rank</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead className="text-right">Volume ({currency} m)</TableHead>
                        <TableHead className="text-right">Deals</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((bank) => (
                        <TableRow key={bank.id}>
                            <TableCell className="font-medium">
                                {bank.stats.rank === '=' ? <span className="text-slate-400">=</span> : bank.stats.rank}
                            </TableCell>
                            <TableCell className="font-semibold">{bank.name}</TableCell>
                            <TableCell className="text-right font-mono">
                                {bank.stats.volume?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-mono">{bank.stats.count}</TableCell>
                            <TableCell className="text-right font-mono">
                                {(bank.stats.share * 100).toFixed(2)}%
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    return (
        <Tabs defaultValue="uk" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="uk">UK League Table</TabsTrigger>
                <TabsTrigger value="eu">European League Table</TabsTrigger>
            </TabsList>

            <TabsContent value="uk" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>UK Rankings (Feb 26)</CardTitle>
                        <CardDescription>Top Banks by Volume (GBP)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LeagueTable data={ukList} currency="GBP" />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="eu" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>European Rankings (Feb 26)</CardTitle>
                        <CardDescription>Top Banks by Volume (EUR)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LeagueTable data={euList} currency="EUR" />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
