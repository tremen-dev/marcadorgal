// Resolves with the work or rejects once the deadline passes, even when the
// work ignores its abort signal (an injected double); the timer is always
// cleared. SPEC-059 CA-4, SPEC-085 CA-3.
export function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  label = "explorer",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[${label}] timeout ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
