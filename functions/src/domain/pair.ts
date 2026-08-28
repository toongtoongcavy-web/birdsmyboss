import { fail } from "./errors.js";

export type PairMember = { pairId?: string; birdId: string; role: "male" | "female"; effectiveFrom: string; effectiveTo?: string };

export const currentMembersAt = (members: PairMember[], on: string): PairMember[] =>
  members.filter((member) => member.effectiveFrom <= on && (!member.effectiveTo || member.effectiveTo >= on));

export const validatePairMembers = (members: PairMember[], sexByBird: Map<string, string>): { maleId: string; femaleId: string } => {
  if (members.length !== 2) fail("failed-precondition", "An active pair requires exactly two current members.");
  const male = members.find((member) => member.role === "male");
  const female = members.find((member) => member.role === "female");
  if (!male || !female || male.birdId === female.birdId) fail("failed-precondition", "An active pair requires one distinct male and one distinct female.");
  const maleMember = male as PairMember;
  const femaleMember = female as PairMember;
  if (sexByBird.get(maleMember.birdId) !== "male" || sexByBird.get(femaleMember.birdId) !== "female") fail("failed-precondition", "Pair member roles must match current sex evidence.");
  return { maleId: maleMember.birdId, femaleId: femaleMember.birdId };
};
