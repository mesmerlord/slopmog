/**
 * Dynamic concurrency limiter for tasks that arrive over time.
 * Unlike pMap (which takes a fixed array), Semaphore gates dynamically-queued work.
 */
export class Semaphore {
  private running = 0;
  private waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => {
        this.waiting.push(resolve);
      });
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}

/**
 * Execute an array of async tasks with a concurrency limit.
 * Like Promise.all but with a max number of concurrent executions.
 */
export async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
