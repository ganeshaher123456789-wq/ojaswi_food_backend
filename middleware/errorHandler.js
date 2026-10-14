/**
 * Centralized error handling middleware.
 * Sanitizes errors so internal stack traces or connection strings are never exposed to customers.
 */
export function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message || err);

  const status = err.status || err.statusCode || 500;
  let message = err.message || "An unexpected error occurred. Please try again.";

  // In production, mask internal 500 error details to avoid exposing internals
  if (process.env.NODE_ENV === "production" && status === 500) {
    message = "Internal server error. Please try again later or contact Ojaswi support.";
  }

  res.status(status).json({
    success: false,
    error: message
  });
}

export default errorHandler;
