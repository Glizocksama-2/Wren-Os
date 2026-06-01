import * as Sentry from "@sentry/node";

let sentryInitialized = false;

export function createErrorTracker({
  dsn = process.env.SENTRY_DSN,
  environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version,
  logger
} = {}) {
  const enabled = Boolean(dsn);
  if (enabled && !sentryInitialized) {
    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate: 0
    });
    sentryInitialized = true;
  }

  return {
    enabled,
    captureException(error, context = {}) {
      if (!enabled) return;
      try {
        Sentry.withScope((scope) => {
          Object.entries(context).forEach(([key, value]) => scope.setExtra(key, value));
          Sentry.captureException(error);
        });
      } catch (trackingError) {
        logger?.warn?.({
          event: "error_tracking_failed",
          message: trackingError instanceof Error ? trackingError.message : String(trackingError)
        });
      }
    }
  };
}
