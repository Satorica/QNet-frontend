import { ref, type Ref } from "vue";
import type { MethodType, ProblemType } from "../types/api";

// Keep classic algorithm selections across route changes for the current app session.
const solverSelections = {
  maxcut: ref<MethodType>("sa"),
  number_partition: ref<MethodType>("sa"),
  coloring: ref<MethodType>("sa"),
  tsp: ref<MethodType>("sa"),
  general: ref<MethodType>("sa"),
} satisfies Record<ProblemType, Ref<MethodType>>;

export const useAlgorithmSelection = (problemType: ProblemType) =>
  solverSelections[problemType];
