export class MilestoneRepositoryError extends Error {
  constructor(message: string, readonly code: string | null = null) { super(message); }
}
export class MilestoneHttpError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
