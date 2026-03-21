import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { analytics } from '../analytics';
import { normalizeSearchResult, type SearchResult } from '../shared/searchSchema';

export function useProductSearch() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('Global');
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queryValidationError, setQueryValidationError] = useState<string | null>(null);

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [selectedStore, setSelectedStore] = useState<string>('All');
  const [minRating, setMinRating] = useState<number>(0);

  const loadingTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const clearLoadingTimers = () => {
    loadingTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
    loadingTimeoutsRef.current = [];
  };

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

  const uniqueStores = useMemo(
    () => (result ? Array.from(new Set(result.recommendations.map((rec) => rec.storeName))) : []),
    [result]
  );

  const detectedCurrency = result?.detectedCurrency || 'USD';

  const clearFilters = () => {
    setMaxPrice('');
    setSelectedStore('All');
    setMinRating(0);
  };

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
