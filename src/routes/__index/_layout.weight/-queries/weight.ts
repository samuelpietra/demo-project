import { getWeightEntriesServerFn } from "@/lib/weight.server";
import { queryOptions } from "@tanstack/react-query";

export const weightEntriesQueryOptions = () =>
  queryOptions({
    queryKey: ["weight-entries"],
    queryFn: () => getWeightEntriesServerFn(),
  });
