export interface ErrorInfo {
  status: number;
  message: string;
  isQuotaError: boolean;
  isTemporaryOverloadError?: boolean;
}

/**
 * Detects if an error is a Gemini API quota/rate limit error.
 * Handles multiple error formats from the Google AI SDK.
 */
export function isQuotaError(error: any): boolean {
  if (!error) return false;

  const errorString = String(error?.message || '');
  
  return (
    error?.status === 429 ||
    error?.error?.code === 429 ||
    errorString.includes('429') ||
    errorString.toLowerCase().includes('quota') ||
    errorString.includes('RESOURCE_EXHAUSTED')
  );
}

/**
 * Detects temporary provider overload/capacity errors.
 * Covers common formats from AI providers and gateway wrappers.
 */
export function isTemporaryOverloadError(error: any): boolean {
  if (!error) return false;

  const status = Number(error?.status || error?.error?.code || 0);
  const errorString = String(error?.message || error?.error?.message || '').toLowerCase();

  return (
    status === 503 ||
    errorString.includes('503') ||
    errorString.includes('unavailable') ||
    errorString.includes('high demand') ||
    errorString.includes('temporarily unavailable') ||
    errorString.includes('overloaded')
  );
}

/**
 * Classifies error and returns standardized error info for API responses.
 * Used on the backend to return consistent error responses.
 */
export function classifyError(error: any): ErrorInfo {
  const isQuota = isQuotaError(error);
  const isOverload = isTemporaryOverloadError(error);
  
  return {
    status: isQuota ? 429 : isOverload ? 503 : 500,
    message: isQuota 
      ? 'The AI quota has been exceeded. Please try again later.'
      : isOverload
      ? 'AI providers are experiencing high demand right now. Please retry in a few moments.'
      : error?.message || 'An unexpected error occurred.',
    isQuotaError: isQuota,
    isTemporaryOverloadError: isOverload,
  };
}

/**
 * Generates user-friendly error message for frontend display.
 * Provides context-specific messaging for quota vs other errors.
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const isQuota = isQuotaError(error);
  const isOverload = isTemporaryOverloadError(error);
  const rawMessage = String(error?.message || '').trim();
  const normalizedMessage = rawMessage.toLowerCase();
  const looksLikeHtml = normalizedMessage.includes('<!doctype') || normalizedMessage.includes('<html');
  
  if (isQuota) {
    return 'The AI search quota has been exceeded. Please try again later or check your API key billing details.';
  }

  if (isOverload) {
    return 'Search provider is busy right now (high demand). Please try again in 20-60 seconds.';
  }

  if (looksLikeHtml || normalizedMessage.includes('internal server error')) {
    return 'The search service is temporarily unavailable. Please try again in a moment.';
  }
  
  return error?.message || 'An error occurred. Please try again.';
}
