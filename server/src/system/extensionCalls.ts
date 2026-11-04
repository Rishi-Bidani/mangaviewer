// how the server calls into extensions: one call at a time per extension, keeping to its rate limit,
// with a time limit, and with what someone is waiting for ahead of work in the background
import { setTimeout as sleep } from "node:timers/promises";

/**
 * @brief interactive calls go ahead of background ones, which only run when nothing else is waiting
 */
export type CallPriority = "interactive" | "background";

interface IQueuedCall {
    minIntervalMs: number;
    /**
     * @returns a promise for when the next call can start, which never rejects
     */
    start(): Promise<void>;
}

interface ICallQueue {
    interactive: IQueuedCall[];
    background: IQueuedCall[];
    running: boolean;
}

// long enough to wait out a rate limit, but a stuck call can't hold up the rest
const CALL_TIMEOUT_MS = 3 * 60 * 1000;
// how long a timed out call gets to stop, for extensions that don't use the abort signal
const ABORT_GRACE_MS = 30_000;

const queues = new Map<string, ICallQueue>();

export function withTimeout<T>(
    task: Promise<T>,
    ms: number,
    what: string,
    onTimeout?: () => void
): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            onTimeout?.();
            reject(new Error(`${what} timed out`));
        }, ms);
    });
    return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

async function runQueue(queue: ICallQueue) {
    if (queue.running) {
        return;
    }
    queue.running = true;
    for (;;) {
        const next = queue.interactive.shift() ?? queue.background.shift();
        if (!next) {
            break;
        }
        await next.start();
        await sleep(next.minIntervalMs);
    }
    queue.running = false;
}

/**
 * @brief runs a call to an extension once it's its turn
 * @param call gets a signal that's aborted when the call runs out of time
 */
export function callExtension<T>(
    id: string,
    minIntervalMs: number | undefined,
    priority: CallPriority,
    call: (signal: AbortSignal) => Promise<T>
): Promise<T> {
    let queue = queues.get(id);
    if (!queue) {
        queue = { interactive: [], background: [], running: false };
        queues.set(id, queue);
    }
    return new Promise<T>((resolve, reject) => {
        const start = () => {
            const controller = new AbortController();
            // inside async, so a call that throws straight away is a rejection too
            const task = (async () => call(controller.signal))();
            const result = withTimeout(task, CALL_TIMEOUT_MS, `A call to "${id}"`, () =>
                controller.abort()
            );
            result.then(resolve, reject);
            const finished = task.then(
                () => {},
                () => {}
            );
            return result.then(
                () => {},
                () => Promise.race([finished, sleep(ABORT_GRACE_MS)])
            );
        };
        (queue as ICallQueue)[priority].push({ minIntervalMs: minIntervalMs ?? 0, start });
        void runQueue(queue as ICallQueue);
    });
}

/**
 * @brief runs a quick call to an extension that nothing else depends on, so that a broken extension
 * can't break the page or request that asked for it
 * @returns what it returned, undefined if it threw
 */
export function guarded<T>(id: string, call: () => T): T | undefined {
    try {
        return call();
    } catch (error) {
        console.warn(`A call to "${id}" failed: ${(error as Error).message}`);
        return undefined;
    }
}
