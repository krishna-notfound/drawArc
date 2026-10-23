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

function serializeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { name: 'NonError', message: String(err) };
}

function redact(fields: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : value;
  }
  return out;
}

function createLogger(bindings: LogContext): Logger {
  const write = (level: LogLevel, ctx: LogContext, msg: string): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[env.LOG_LEVEL]) return;
    const { err, ...rest } = { ...bindings, ...ctx };
    const line = {
      level,
      time: new Date().toISOString(),
      msg,
      ...redact(rest),
      ...(err === undefined ? {} : { err: serializeError(err) }),
    };
    const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(line)}\n`);
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
