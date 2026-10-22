export interface LogContext {
  [key: string]: unknown;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({ level: 'INFO', timestamp, message, ...context }));
  },
  warn(message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    console.warn(JSON.stringify({ level: 'WARN', timestamp, message, ...context }));
  },
  error(message: string, error?: unknown, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? { errorName: error.name, errorMsg: error.message, stack: error.stack } : { rawError: error };
    console.error(JSON.stringify({ level: 'ERROR', timestamp, message, ...errorDetails, ...context }));
  }
};
