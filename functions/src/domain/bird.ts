export const terminalBirdStatuses = ["sold", "given_away", "deceased", "lost"] as const;

export const isTerminalBirdStatus = (status: unknown): boolean =>
  terminalBirdStatuses.includes(String(status) as (typeof terminalBirdStatuses)[number]);
