// File role: Error classification helpers used by API and UI mapping layers.
export interface ErrorInfo {
  status: number;
  message: string;
  isQuotaError: boolean;
  isTemporaryOverloadError?: boolean;
}

/**
 * Is Quota Error to keep behavior centralized and easier to reason about.
 *
 * @param error - error passed by the caller to control this behavior.
 * @returns True when the condition is met so callers can branch safely.
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
 * Is Temporary Overload Error to keep behavior centralized and easier to reason about.
 *
 * @param error - error passed by the caller to control this behavior.
 * @returns True when the condition is met so callers can branch safely.
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
 * Classify Error to keep behavior centralized and easier to reason about.
 *
 * @param error - error passed by the caller to control this behavior.
 * @returns void
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
 * Get User Friendly Error Message to keep behavior centralized and easier to reason about.
 *
 * @param error - error passed by the caller to control this behavior.
 * @returns Computed value used by downstream logic.
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

