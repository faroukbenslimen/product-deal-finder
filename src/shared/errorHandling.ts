export interface ErrorInfo {
  status: number;
  message: string;
  isQuotaError: boolean;
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
 * Classifies error and returns standardized error info for API responses.
 * Used on the backend to return consistent error responses.
 */
export function classifyError(error: any): ErrorInfo {
  const isQuota = isQuotaError(error);
  
  return {
    status: isQuota ? 429 : 500,
    message: isQuota 
      ? 'The AI quota has been exceeded. Please try again later.'
      : error?.message || 'An unexpected error occurred.',
    isQuotaError: isQuota,
  };
}

/**
 * Generates user-friendly error message for frontend display.
 * Provides context-specific messaging for quota vs other errors.
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const isQuota = isQuotaError(error);
  
  if (isQuota) {
    return 'The AI search quota has been exceeded. Please try again later or check your API key billing details.';
  }
  
  return error?.message || 'An error occurred. Please try again.';
}
