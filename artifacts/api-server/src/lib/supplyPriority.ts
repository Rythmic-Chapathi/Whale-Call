export type PriorityUrgency = "routine" | "urgent" | "critical";

const URGENCY_WEIGHT: Record<PriorityUrgency, number> = {
  routine: 1,
  urgent: 3,
  critical: 5,
};
const CRITICALITY_BONUS: Record<number, number> = { 1: 0, 2: 1, 3: 3 };
const ACCESSIBILITY_BONUS = 2;
const EMERGENCY_LINK_BONUS = 4;
const DECAY_PER_MINUTE = 0.15;

export function priorityScore(input: {
  urgency: PriorityUrgency;
  maxCriticality: number;
  accessibilityNeed: boolean;
  linkedEmergencyId: string | null;
  createdAt: Date;
}, now = new Date()): number {
  const minutesWaiting = Math.max(0, (now.getTime() - input.createdAt.getTime()) / 60_000);
  const base =
    URGENCY_WEIGHT[input.urgency] +
    (CRITICALITY_BONUS[input.maxCriticality] ?? 0) +
    (input.accessibilityNeed ? ACCESSIBILITY_BONUS : 0) +
    (input.linkedEmergencyId ? EMERGENCY_LINK_BONUS : 0);
  return Number((base + minutesWaiting * DECAY_PER_MINUTE).toFixed(2));
}

export function priorityReason(input: {
  urgency: PriorityUrgency;
  maxCriticality: number;
  accessibilityNeed: boolean;
  linkedEmergencyId: string | null;
}): string {
  const reasons = [
    input.maxCriticality === 3 ? "life-critical supplies" : input.maxCriticality === 2 ? "important supplies" : null,
    input.urgency !== "routine" ? input.urgency : null,
    input.accessibilityNeed ? "carry-up help needed" : null,
    input.linkedEmergencyId ? "attached to a rescue" : null,
  ].filter(Boolean);
  return reasons.length ? reasons.join(", ") : "routine island supply run";
}