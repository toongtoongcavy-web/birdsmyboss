export type KinshipResult =
  | { status: "clear" }
  | { status: "unknown" }
  | { status: "blocked"; reason: "parent_offspring" | "siblings" }
  | { status: "warning"; reason: "other_detectable_kinship" };

export type ParentLookup = (birdId: string) => string[] | undefined;

export const classifyKinship = (firstBirdId: string, secondBirdId: string, parentsOf: ParentLookup): KinshipResult => {
  const firstParents = parentsOf(firstBirdId);
  const secondParents = parentsOf(secondBirdId);
  if (firstParents?.includes(secondBirdId) || secondParents?.includes(firstBirdId)) return { status: "blocked", reason: "parent_offspring" };
  if (!firstParents || !secondParents) return { status: "unknown" };
  if (firstParents.some((parent) => secondParents.includes(parent))) return { status: "blocked", reason: "siblings" };
  return { status: "clear" };
};
