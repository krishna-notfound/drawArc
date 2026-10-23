import 'server-only';

import { env, type LogLevel } from './env';

export interface LogContext {
  requestId?: string;
  userId?: string;
  projectId?: string;
  runId?: string;
  err?: unknown;
  [key: string]: unknown;
}

export interface Logger {
  debug(ctx: LogContext, msg: string): void;
  info(ctx: LogContext, msg: string): void;
  warn(ctx: LogContext, msg: string): void;
  error(ctx: LogContext, msg: string): void;
  child(bindings: LogContext): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE_KEY = /password|token|secret|authorization/i;

// `new Date()` is a blocking value during Cache Components prerendering; `performance.now()` is not guarded.
function timestamp(): string {
  return new Date(performance.timeOrigin + performance.now()).toISOString();
}

function serializeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { name: 'NonError', message: String(err) };
}

/** JSON replacer: redacts sensitive keys at any depth, serialises Errors and BigInts, and breaks cycles. */
function safeReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (key, value) => {
    if (key !== '' && SENSITIVE_KEY.test(key)) return '[redacted]';
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Error) return serializeError(value);
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  };
}

function serializeLine(line: Record<string, unknown>): string {
  try {
    return JSON.stringify(line, safeReplacer());
  } catch {
    // A throwing toJSON or getter must never replace the caller's own error.
    return JSON.stringify({ level: line.level, time: line.time, msg: line.msg, logError: 'unserializable' });
  }
}

function createLogger(bindings: LogContext): Logger {
  const write = (level: LogLevel, ctx: LogContext, msg: string): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[env.LOG_LEVEL]) return;
    const { err, ...rest } = { ...bindings, ...ctx };
    const line = {
      level,
      time: timestamp(),
      msg,
      ...rest,
      ...(err === undefined ? {} : { err: serializeError(err) }),
    };
    const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
    stream.write(`${serializeLine(line)}\n`);
  };

  return {
    debug: (ctx, msg) => write('debug', ctx, msg),
    info: (ctx, msg) => write('info', ctx, msg),
    warn: (ctx, msg) => write('warn', ctx, msg),
    error: (ctx, msg) => write('error', ctx, msg),
    child: (childBindings) => createLogger({ ...bindings, ...childBindings }),
  };
}

export const logger: Logger = createLogger({});
