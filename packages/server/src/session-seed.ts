import { randomBytes } from "node:crypto";

export type SessionSeedFactory = (input: {
  sessionId: string;
  gameId: string;
}) => string;

export const createPrivateSessionSeed: SessionSeedFactory = () => randomBytes(32).toString("hex");
