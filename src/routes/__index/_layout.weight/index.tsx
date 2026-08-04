import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addWeightEntryServerFn } from "@/lib/weight.server";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weightEntriesQueryOptions } from "./-queries/weight";

export const Route = createFileRoute("/__index/_layout/weight/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(weightEntriesQueryOptions());
  },
  component: WeightPage,
});

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function WeightPage() {
  const queryClient = useQueryClient();
  const { data: entries } = useSuspenseQuery(weightEntriesQueryOptions());
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");

  const addWeightMutation = useMutation({
    mutationFn: (value: number) => addWeightEntryServerFn({ data: { weight: value } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weightEntriesQueryOptions().queryKey });
      setWeight("");
      setError("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(weight);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a weight greater than 0");
      return;
    }
    addWeightMutation.mutate(value);
  };

  const chartData = entries.map((entry) => ({
    date: formatDate(entry.recordedAt),
    weight: entry.weight,
  }));
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Weight</h1>
        {latest && (
          <p className="text-sm text-slate-500">
            Latest: <span className="font-semibold text-slate-900">{latest.weight} lbs</span>
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log your weight</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              type="number"
              step="0.1"
              min={0}
              placeholder="Weight (lbs)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!weight.trim() || addWeightMutation.isPending}>
              {addWeightMutation.isPending ? "Saving..." : "Log"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">No weight logged yet. Log your first entry above!</p>
          ) : (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      domain={["dataMin - 5", "dataMax + 5"]}
                      tick={{ fontSize: 12 }}
                      stroke="#94a3b8"
                      width={44}
                      allowDecimals={false}
                    />
                    <Tooltip formatter={(value) => [`${value} lbs`, "Weight"]} />
                    <Line type="monotone" dataKey="weight" stroke="#047857" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2">
                {[...entries].reverse().map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span className="text-slate-500">{formatDate(entry.recordedAt)}</span>
                    <span className="font-medium text-slate-700">{entry.weight} lbs</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
