import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { deleteWorkoutsServerFn } from "@/lib/workouts.server";
import { Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { workoutHistoryQueryOptions } from "./-queries/workout-history";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const METRICS = [
  { key: "maxWeight", label: "Max weight", unit: " lbs" },
  { key: "totalReps", label: "Total reps", unit: "" },
  { key: "totalVolume", label: "Total volume", unit: " lbs" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

type Metrics = { maxWeight: number; totalReps: number; totalVolume: number };
type ProgressionPoint = { date: number; label: string } & Metrics;
type ProgressionWorkout = {
  completedAt: Date | null;
  sets: { weight: number; reps: number; movement: { id: string } }[];
};

function summarizeSets(sets: { weight: number; reps: number }[]): Metrics {
  return {
    maxWeight: Math.max(...sets.map((s) => s.weight)),
    totalReps: sets.reduce((total, s) => total + s.reps, 0),
    totalVolume: sets.reduce((total, s) => total + s.weight * s.reps, 0),
  };
}

// One point per completed workout: the README says max weight "on a given day"
// but total volume "in a workout", and per workout keeps all three metrics on
// one x-axis. Two workouts in a day therefore plot as two points.
function computeProgression(workouts: ProgressionWorkout[], movementId: string): ProgressionPoint[] {
  const dataPoints: ProgressionPoint[] = [];
  if (!movementId) return dataPoints;

  for (const workout of workouts) {
    // Keep only this movement's sets; skip workouts it didn't appear in.
    const movementSets = workout.sets.filter((s) => s.movement.id === movementId);
    if (movementSets.length === 0) continue;

    const completedAt = new Date(workout.completedAt!);
    dataPoints.push({
      date: completedAt.getTime(), // numeric — sorting only
      label: completedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), // x-axis text
      ...summarizeSets(movementSets),
    });
  }

  return dataPoints.sort((a, b) => a.date - b.date); // oldest -> newest
}

export const Route = createFileRoute("/__index/_layout/workout-history/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(workoutHistoryQueryOptions());
  },
  component: WorkoutHistoryPage,
});

function WorkoutHistoryPage() {
  const queryClient = useQueryClient();
  const { data: workouts } = useSuspenseQuery(workoutHistoryQueryOptions());
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set());
  const [selectedMovementId, setSelectedMovementId] = useState("");
  const [metric, setMetric] = useState<MetricKey>("maxWeight");

  const deleteWorkoutsMutation = useMutation({
    mutationFn: (workoutIds: string[]) => deleteWorkoutsServerFn({ data: { workoutIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutHistoryQueryOptions().queryKey });
      setSelectedWorkouts(new Set());
    },
  });

  // Deduplicate movements across the loaded workouts, then sort by name.
  const uniqueMovements = useMemo(() => {
    const nameById = new Map<string, string>();
    for (const workout of workouts) {
      for (const set of workout.sets) {
        nameById.set(set.movement.id, set.movement.name);
      }
    }
    return Array.from(nameById, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts]);

  // The movement whose progression is charted: the user's selection, or the
  // first available movement, or none.
  const activeMovementId = useMemo(() => {
    if (selectedMovementId) return selectedMovementId;
    return uniqueMovements[0]?.id ?? "";
  }, [selectedMovementId, uniqueMovements]);

  const activeMetric = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const progressionData = useMemo(() => computeProgression(workouts, activeMovementId), [workouts, activeMovementId]);

  const toggleWorkout = (id: string) => {
    setSelectedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedWorkouts.size === workouts.length) {
      setSelectedWorkouts(new Set());
    } else {
      setSelectedWorkouts(new Set(workouts.map((w) => w.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedWorkouts.size === 0) return;
    deleteWorkoutsMutation.mutate(Array.from(selectedWorkouts));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Workout History</h1>
      </div>

      {workouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progression</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select
                value={activeMovementId}
                onChange={(e) => setSelectedMovementId(e.target.value)}
                className="w-56">
                {uniqueMovements.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} className="w-48">
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            {progressionData.length === 0 ? (
              <p className="text-sm text-slate-500">No data for this movement yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressionData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" width={48} allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value}${activeMetric.unit}`, activeMetric.label]} />
                    <Line type="monotone" dataKey={metric} stroke="#047857" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Completed Workouts</CardTitle>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={selectedWorkouts.size === 0}>
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteWorkoutsMutation.isPending ? "Deleting..." : `Delete Selected (${selectedWorkouts.size})`}
          </Button>
        </CardHeader>
        <CardContent>
          {workouts.length === 0 ? (
            <p className="text-sm text-slate-500">No completed workouts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedWorkouts.size === workouts.length}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Sets</th>
                    {uniqueMovements.map(({ id, name }) => (
                      <th key={id} className="text-right py-3 px-4 font-medium text-slate-600">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workouts.map((workout) => {
                    const setsByMovement = new Map<string, typeof workout.sets>();
                    workout.sets.forEach((set) => {
                      const existing = setsByMovement.get(set.movement.id) || [];
                      setsByMovement.set(set.movement.id, [...existing, set]);
                    });

                    const isSelected = selectedWorkouts.has(workout.id);
                    return (
                      <tr
                        key={workout.id}
                        className={`border-b border-slate-100 ${isSelected ? "bg-primary/10" : "hover:bg-slate-50"}`}>
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedWorkouts.has(workout.id)}
                            onChange={() => toggleWorkout(workout.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {workout.completedAt
                            ? new Date(workout.completedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{workout.sets.length}</td>
                        {uniqueMovements.map(({ id: movementId }) => {
                          const movementSets = setsByMovement.get(movementId);
                          if (!movementSets || movementSets.length === 0) {
                            return (
                              <td key={movementId} className="py-3 px-4 text-right text-slate-300">
                                -
                              </td>
                            );
                          }
                          const maxWeight = Math.max(...movementSets.map((s) => s.weight));
                          const avgReps = Math.round(
                            movementSets.reduce((sum, s) => sum + s.reps, 0) / movementSets.length,
                          );
                          const numSets = movementSets.length;
                          return (
                            <td key={movementId} className="py-3 px-4 text-right text-slate-600">
                              {maxWeight} lbs / {avgReps} reps / {numSets} sets
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
