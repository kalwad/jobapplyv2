export class EvaluationRunnerError extends Error {
  public readonly code: string;
  public readonly pointer: string;

  public constructor(code: string, pointer: string, detail: string) {
    super(`${code} ${pointer}: ${detail}`);
    this.name = "EvaluationRunnerError";
    this.code = code;
    this.pointer = pointer;
  }
}

export function runnerFail(
  code: string,
  pointer: string,
  detail: string,
): never {
  throw new EvaluationRunnerError(code, pointer, detail);
}
