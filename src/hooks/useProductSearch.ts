// File role: Centralized search state and async workflow orchestration hook.
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { analytics } from '../analytics';
import { normalizeSearchResult, type SearchResult } from '../shared/searchSchema';

/**
 * Use Product Search to keep behavior centralized and easier to reason about.
 *
 * @returns void
 */
export function useProductSearch() {
 /** Keeps the current user query text as the source of truth for searches. */
  const [query, setQuery] = useState('');
 /** Stores the active region so API requests and result filtering stay aligned. */
  const [region, setRegion] = useState('Global');
 /** Signals active search execution to disable inputs and show loading UI. */
  const [isLoading, setIsLoading] = useState(false);
 /** Tracks the current progress phase displayed in the stepper component. */
  const [activeStep, setActiveStep] = useState(0);
 /** Holds the latest normalized search payload rendered by the page. */
  const [result, setResult] = useState<SearchResult | null>(null);
 /** Stores the current user-facing error message for request failures. */
  const [error, setError] = useState<string | null>(null);
 /** Stores validation feedback when the query is too short or unclear. */
  const [queryValidationError, setQueryValidationError] = useState<string | null>(null);

 /** Indicates whether image-based product identification is currently running. */
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
 /** Keeps a preview data URL so users can verify the uploaded image. */
  const [previewImage, setPreviewImage] = useState<string | null>(null);

 /** Applies an optional maximum-price constraint to displayed recommendations. */
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
 /** Stores the chosen merchant filter for narrowing recommendation lists. */
  const [selectedStore, setSelectedStore] = useState<string>('All');
 /** Stores the minimum rating threshold used by client-side filtering. */
  const [minRating, setMinRating] = useState<number>(0);

 /** Keeps timeout handles so staged loading progress can be cancelled reliably. */
  const loadingTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
 /** Keeps the active request controller so a new search can abort stale requests. */
  const searchAbortControllerRef = useRef<AbortController | null>(null);

 /**
 * Clears Loading Timers.
 *
 * @returns void
 */


  const clearLoadingTimers = () => {
    loadingTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
    loadingTimeoutsRef.current = [];
  };

 /**
 * Starts Loading Progress.
 *
 * @returns void
 */


  const startLoadingProgress = () => {
    clearLoadingTimers();
    setActiveStep(0);
    loadingTimeoutsRef.current.push(
      setTimeout(() => setActiveStep(1), 500),
      setTimeout(() => setActiveStep(2), 2000),
      setTimeout(() => setActiveStep(3), 4000),
    );
  };

  useEffect(() => {
    return () => {
      clearLoadingTimers();
      searchAbortControllerRef.current?.abort();
    };
  }, []);

 /**
 * Maps Search Error Message.
 *
 * @param err - Value supplied by the caller.
 * @returns Computed value used by downstream logic.
 */


  const mapSearchErrorMessage = (err: unknown): string => {
    const status = typeof (err as { status?: unknown })?.status === 'number'
      ? ((err as { status?: number }).status as number)
      : undefined;
    const message = err instanceof Error ? err.message : '';

    if (status === 429) {
      return 'Too many searches. Please wait a moment and try again.';
    }
    if (message.includes('Unexpected response format')) {
      return 'Unexpected response format. Please try again.';
    }
    if (message.includes('RESOURCE_EXHAUSTED')) {
      return 'Daily search limit reached. Try again tomorrow.';
    }
    if (err instanceof TypeError || /fetch/i.test(message)) {
      return 'Connection failed. Check your internet connection.';
    }
    return 'Something went wrong. Try a more specific product name.';
  };

 /**
 * Perform Search.
 *
 * @param queryToSearch - Value supplied by the caller.
 * @param regionToSearch - Value supplied by the caller.
 * @param source - Value supplied by the caller.
 * @returns void
 */


  const performSearch = async (queryToSearch: string, regionToSearch: string, source: 'search' | 'image_search') => {
    const searchStartTime = Date.now();
    searchAbortControllerRef.current?.abort();
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    startLoadingProgress();
    setIsLoading(true);
    setError(null);
    setResult(null);
    setMaxPrice('');
    setSelectedStore('All');
    setMinRating(0);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToSearch, region: regionToSearch }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        const tooManyError = new Error('Too many searches. Please wait a moment and try again.') as Error & { status?: number };
        tooManyError.status = 429;
        throw tooManyError;
      }

      const contentType = response.headers.get('content-type') || '';
      let payload: unknown = null;

      if (contentType.toLowerCase().includes('application/json')) {
        payload = await response.json().catch(() => null);
      } else {
        const text = await response.text();
        payload = text ? { error: text } : null;
      }

      if (!response.ok) {
        const payloadRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
        const requestError = new Error(typeof payloadRecord?.error === 'string' ? payloadRecord.error : `Search request failed (${response.status}).`) as Error & { status?: number };
        requestError.status = response.status;
        throw requestError;
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Server returned an empty response. Please try again.');
      }

      const payloadData = payload as { data?: unknown };
      const normalizedResult = normalizeSearchResult(payloadData.data);
      normalizedResult.recommendations.sort((a, b) => (a.isBest === b.isBest ? 0 : a.isBest ? -1 : 1));
      setResult(normalizedResult);

      analytics.trackSearch(queryToSearch, regionToSearch, normalizedResult.recommendations.length);
      analytics.trackTiming('search', Date.now() - searchStartTime);

      if (normalizedResult.recommendations.length === 0 && !normalizedResult.summary.trim()) {
        setError('No results found. Please try a different product.');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const userFriendlyError = mapSearchErrorMessage(err);
      setError(userFriendlyError);
      analytics.trackError(userFriendlyError, source);
      analytics.trackTiming('search', Date.now() - searchStartTime);
    } finally {
      if (searchAbortControllerRef.current === controller) {
        clearLoadingTimers();
        setIsLoading(false);
      }
    }
  };

 /**
 * Handles Search.
 *
 * @param e - Value supplied by the caller.
 * @returns void
 */


  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      setQueryValidationError("Please be more specific (e.g. 'Sony WH-1000XM5 headphones')");
      return;
    }

    setQueryValidationError(null);
    await performSearch(trimmedQuery, region, 'search');
  };

 /**
 * Handles Image Upload.
 *
 * @param file - Value supplied by the caller.
 * @returns void
 */


  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      analytics.trackImageUpload(0, false);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB.');
      analytics.trackImageUpload(file.size, false);
      return;
    }

    setIsAnalyzingImage(true);
    setError(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target?.result;
          if (typeof data === 'string') {
            resolve(data);
            return;
          }
          reject(new Error('Failed to read image file.'));
        };
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      setPreviewImage(base64);

      const response = await fetch('/api/identify-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, region }),
      });

      const payload = await response.json().catch(() => null) as { productName?: string; error?: string } | null;

      if (!response.ok) {
        analytics.trackImageUpload(file.size, false);
        throw new Error(payload?.error || 'Failed to identify product.');
      }

      const identifiedProduct = payload?.productName;
      if (!identifiedProduct) {
        analytics.trackImageUpload(file.size, false);
        throw new Error('No product name extracted.');
      }

      analytics.trackImageUpload(file.size, true);
      setQuery(identifiedProduct);
      await performSearch(identifiedProduct, region, 'image_search');
    } catch (err: unknown) {
      const userFriendlyError = mapSearchErrorMessage(err);
      setError(userFriendlyError);
      analytics.trackError(userFriendlyError, 'image_upload');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

 /** Derives the visible recommendation list from current filter controls. */
  const filteredRecommendations = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.recommendations.filter((rec) => {
      if (maxPrice !== '' && rec.priceValue > maxPrice) return false;
      if (selectedStore !== 'All' && rec.storeName !== selectedStore) return false;
      if (minRating > 0 && rec.ratingScore < minRating) return false;
      return true;
    });
  }, [result, maxPrice, selectedStore, minRating]);

 /** Derives unique store names for the store filter options. */
  const uniqueStores = useMemo(
    () => (result ? Array.from(new Set(result.recommendations.map((rec) => rec.storeName))) : []),
    [result]
  );

 /** Exposes detected currency with a safe default for filter and price labels. */
  const detectedCurrency = result?.detectedCurrency || 'USD';

 /**
 * Clears Filters.
 *
 * @returns void
 */


  const clearFilters = () => {
    setMaxPrice('');
    setSelectedStore('All');
    setMinRating(0);
  };

 /**
 * Starts New Search.
 *
 * @returns void
 */


  const startNewSearch = () => {
    setResult(null);
    setQuery('');
    setError(null);
    setQueryValidationError(null);
    setMaxPrice('');
    setSelectedStore('All');
    setMinRating(0);
  };

  return {
    query,
    setQuery,
    region,
    setRegion,
    isLoading,
    activeStep,
    result,
    error,
    setError,
    queryValidationError,
    setQueryValidationError,
    isAnalyzingImage,
    previewImage,
    maxPrice,
    setMaxPrice,
    selectedStore,
    setSelectedStore,
    minRating,
    setMinRating,
    filteredRecommendations,
    uniqueStores,
    detectedCurrency,
    clearFilters,
    startNewSearch,
    handleSearch,
    handleImageUpload,
  };
}

