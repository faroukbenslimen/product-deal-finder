import { useState, FormEvent, useRef, useEffect } from 'react';
import { Search, ShoppingBag, Star, AlertCircle, CheckCircle2, XCircle, ExternalLink, Loader2, Globe, ChevronDown, ChevronUp, ArrowUpDown, Filter, Package, Truck, Camera, Heart, TrendingUp, ShieldCheck, Clock3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { REGIONS } from './constants';
import { normalizeSearchResult, type SearchResult } from './shared/searchSchema';
import { getUserFriendlyErrorMessage } from './shared/errorHandling';
import { getDirectRecommendationHref, getReliableRecommendationHref } from './utils/linkUtils';
import { analytics } from './analytics';
import ProgressStepper from './components/ProgressStepper';
import SkeletonCard from './components/SkeletonCard';

const PLACEHOLDER_IMAGE = 'https://placehold.co/640x420/e5e7eb/6b7280?text=No+Image';

function toCompactPriceLabel(price: string): string {
  const normalized = price.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 28) return normalized;

  const withoutParentheses = normalized.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (withoutParentheses.length <= 28) return withoutParentheses;

  return `${withoutParentheses.slice(0, 25)}...`;
}

function getRecommendationKey(rec: SearchResult['recommendations'][number]): string {
  const urlPart = rec.url?.trim() || rec.domain?.trim() || 'unknown';
  return `${rec.storeName}-${rec.productName}-${urlPart}`.toLowerCase();
}

function buildPriceHistory(basePrice: number, seedText: string): number[] {
  const safeBase = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 80;
  const seed = Array.from(seedText).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const points = 12;

  return Array.from({ length: points }, (_, i) => {
    const swing = Math.sin((seed + i * 23) * 0.08) * 0.09;
    const noise = Math.cos((seed + i * 11) * 0.13) * 0.03;
    const trend = (points - i) * 0.005;
    const value = safeBase * (1 + swing + noise + trend);
    return Math.max(1, Number(value.toFixed(2)));
  });
}

function sparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = Number((index * stepX).toFixed(2));
      const y = Number((height - ((value - min) / range) * height).toFixed(2));
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function getDealConfidence(rec: SearchResult['recommendations'][number]): number {
  if (rec.confidenceScore > 0) {
    return Math.min(100, Math.max(0, Math.round(rec.confidenceScore)));
  }
  const ratingFactor = Math.min(35, rec.ratingScore * 7);
  const prosFactor = Math.min(20, rec.pros.length * 5);
  const stockFactor = rec.stockStatus && rec.stockStatus !== 'Unknown' ? 20 : 8;
  const shippingFactor = rec.shippingInfo && rec.shippingInfo !== 'Unknown' ? 15 : 6;
  const bestBonus = rec.isBest ? 10 : 0;
  return Math.min(100, Math.round(ratingFactor + prosFactor + stockFactor + shippingFactor + bestBonus));
}

function getConfidenceTone(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

export default function App() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('Global');
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Visual search
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Filters
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [selectedStore, setSelectedStore] = useState<string>('All');
  const [minRating, setMinRating] = useState<number>(0);

  // Table view toggle
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeRecommendation, setActiveRecommendation] = useState<SearchResult['recommendations'][number] | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
    };
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const searchStartTime = Date.now();
    startLoadingProgress();
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveRecommendation(null);
    setWatchlist([]);
    setMaxPrice('');
    setSelectedStore('All');
    setMinRating(0);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, region }),
      });

      const contentType = response.headers.get('content-type') || '';
      let payload: any = null;

      if (contentType.toLowerCase().includes('application/json')) {
        payload = await response.json().catch(() => null);
      } else {
        const text = await response.text();
        payload = text ? { error: text } : null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || `Search request failed (${response.status}).`);
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Server returned an empty response. Please try again.');
      }

      const normalizedResult = normalizeSearchResult(payload?.data);
      normalizedResult.recommendations.sort((a, b) => (a.isBest === b.isBest ? 0 : a.isBest ? -1 : 1));
      setResult(normalizedResult);

      // Track successful search
      analytics.trackSearch(query, region, normalizedResult.recommendations.length);
      analytics.trackTiming('search', Date.now() - searchStartTime);

      if (normalizedResult.recommendations.length === 0 && !normalizedResult.summary.trim()) {
        setError('No results found. Please try a different product.');
      }
    } catch (err: any) {
      console.error("Search error:", err);
      const userFriendlyError = getUserFriendlyErrorMessage(err);
      setError(userFriendlyError);
      
      // Track search error
      analytics.trackError(userFriendlyError, 'search');
      analytics.trackTiming('search', Date.now() - searchStartTime);
    } finally {
      clearLoadingTimers();
      setIsLoading(false);
    }
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
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setPreviewImage(base64);

        try {
          // Send to backend
          const response = await fetch('/api/identify-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, region }),
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            analytics.trackImageUpload(file.size, false);
            throw new Error(payload?.error || 'Failed to identify product.');
          }

          const identifiedProduct = payload?.productName;
          if (!identifiedProduct) {
            analytics.trackImageUpload(file.size, false);
            throw new Error('No product name extracted.');
          }

          // Track successful image upload
          analytics.trackImageUpload(file.size, true);

          // Auto-search with identified product
          setQuery(identifiedProduct);
          startLoadingProgress();
          setIsLoading(true);
          setResult(null);
          setActiveRecommendation(null);
          setWatchlist([]);
          setMaxPrice('');
          setSelectedStore('All');
          setMinRating(0);

          try {
            const searchResponse = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: identifiedProduct, region }),
            });

            const contentType = searchResponse.headers.get('content-type') || '';
            let searchPayload: any = null;

            if (contentType.toLowerCase().includes('application/json')) {
              searchPayload = await searchResponse.json().catch(() => null);
            } else {
              const text = await searchResponse.text();
              searchPayload = text ? { error: text } : null;
            }

            if (!searchResponse.ok) {
              throw new Error(searchPayload?.error || `Search request failed (${searchResponse.status}).`);
            }

            const normalizedResult = normalizeSearchResult(searchPayload?.data);
            normalizedResult.recommendations.sort((a, b) => (a.isBest === b.isBest ? 0 : a.isBest ? -1 : 1));
            setResult(normalizedResult);

            // Track search from image
            analytics.trackSearch(identifiedProduct, region, normalizedResult.recommendations.length);

            if (normalizedResult.recommendations.length === 0 && !normalizedResult.summary.trim()) {
              setError('No results found. Please try a different product.');
            }
          } finally {
            clearLoadingTimers();
            setIsLoading(false);
          }
        } catch (err: any) {
          console.error('Search error:', err);
          const userFriendlyError = getUserFriendlyErrorMessage(err);
          setError(userFriendlyError);
          analytics.trackError(userFriendlyError, 'image_search');
          clearLoadingTimers();
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Image upload error:', err);
      const userFriendlyError = getUserFriendlyErrorMessage(err);
      setError(userFriendlyError);
      analytics.trackError(userFriendlyError, 'image_upload');
      setIsAnalyzingImage(false);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleDragDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = (e.dataTransfer as DataTransfer).files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const filteredRecommendations = result?.recommendations.filter(rec => {
    if (maxPrice !== '' && rec.priceValue > maxPrice) return false;
    if (selectedStore !== 'All' && rec.storeName !== selectedStore) return false;
    if (minRating > 0 && rec.ratingScore < minRating) return false;
    return true;
  }) || [];

  const uniqueStores = result ? Array.from(new Set(result.recommendations.map(r => r.storeName))) : [];

  // Get all unique specification keys for the table
  const allSpecKeys = Array.from(
    new Set<string>(
      filteredRecommendations.flatMap(r => 
        (r.specifications || []).map(s => s.feature)
      )
    )
  );

  const sortedRecommendations = [...filteredRecommendations].sort((a, b) => {
    if (!sortConfig) return 0;
    
    const { key, direction } = sortConfig;
    let aValue: any;
    let bValue: any;

    if (key === 'Price') {
      aValue = a.priceValue;
      bValue = b.priceValue;
    } else if (key === 'Rating') {
      aValue = a.ratingScore;
      bValue = b.ratingScore;
    } else if (key === 'Product & Store') {
      aValue = a.productName || a.storeName;
      bValue = b.productName || b.storeName;
    } else {
      const aSpec = (a.specifications || []).find(s => s.feature === key);
      const bSpec = (b.specifications || []).find(s => s.feature === key);
      aValue = aSpec ? aSpec.value : '';
      bValue = bSpec ? bSpec.value : '';
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const isTableView = viewMode === 'table' && result && filteredRecommendations.length > 0;
  const containerMaxWidth = isTableView ? 'max-w-[98vw] xl:max-w-[95vw] 2xl:max-w-[1800px]' : 'max-w-5xl';

  const getRecommendationHref = (rec: SearchResult['recommendations'][number]) => getReliableRecommendationHref(rec, query);

  const toggleWatchlist = (rec: SearchResult['recommendations'][number]) => {
    const key = getRecommendationKey(rec);
    const isInWatchlist = watchlist.includes(key);
    analytics.trackWatchlistAction(isInWatchlist ? 'remove' : 'add', rec.storeName);
    setWatchlist((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const watchedRecommendations = filteredRecommendations.filter((rec) => watchlist.includes(getRecommendationKey(rec)));

  const avgConfidence = filteredRecommendations.length > 0
    ? Math.round(filteredRecommendations.reduce((acc, rec) => acc + getDealConfidence(rec), 0) / filteredRecommendations.length)
    : 0;

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />;
  };

  return (
    <div className="min-h-screen app-shell text-neutral-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Header */}
      <header className="bg-white/80 border-b border-neutral-200 sticky top-0 z-50 backdrop-blur-lg">
        <div className={`${containerMaxWidth} mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between transition-all duration-500`}>
          <div className="flex items-center gap-2">
            <div className="bg-[linear-gradient(135deg,#0f172a,#1e293b)] p-2 rounded-lg shadow-lg shadow-slate-900/20">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Deal Finder</h1>
              <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 font-semibold">Market Radar</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-200 bg-white text-neutral-600">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              {filteredRecommendations.length || 0} live offers
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-200 bg-white text-neutral-600">
              <Heart className="w-3.5 h-3.5 text-rose-600" />
              {watchlist.length} watched
            </span>
          </div>
        </div>
      </header>

      <main className={`${containerMaxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-12 transition-all duration-500`}>
        {/* Search Section */}
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-neutral-200 text-xs font-semibold tracking-wide uppercase text-neutral-600 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Confidence-ranked deal intelligence
          </div>
          <h2 className="display-title text-4xl sm:text-5xl tracking-tight text-neutral-900 mb-4">
            Find the best place to buy anything.
          </h2>
          <p className="text-lg text-neutral-600 mb-8">
            We scan stores, estimate trust, and surface the offers most likely to be worth your money.
          </p>

          <form onSubmit={handleSearch} className="flex flex-col gap-4 max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., Sony WH-1000XM5 headphones"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-300 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg transition-shadow"
                  disabled={isLoading}
                />
              </div>
              
              <div className="relative sm:w-48 shrink-0">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full pl-12 pr-10 py-4 bg-white border border-neutral-300 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg appearance-none cursor-pointer"
                  disabled={isLoading}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              </div>

              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-8 py-4 bg-[linear-gradient(120deg,#0f172a,#1e293b)] text-white font-medium rounded-2xl hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center min-w-[120px]"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1 text-center sm:text-left">
              Regional availability is AI-estimated and may not be 100% accurate.
            </p>
          </form>

          {/* Visual Search Section */}
          <div className="mt-8 pt-8 border-t border-neutral-300 flex flex-col gap-4 max-w-3xl mx-auto">
            <p className="text-sm font-medium text-neutral-700 text-center">Or use an image to search</p>
            <div
              onDrop={handleDragDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <label htmlFor="image-upload" className="cursor-pointer block">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <Camera className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {isAnalyzingImage ? 'Analyzing image...' : 'Drag an image here or click to upload'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Support image up to 5MB</p>
                  </div>
                  {previewImage && !isAnalyzingImage && (
                    <img src={previewImage} alt="Preview" className="mt-3 h-24 rounded-lg shadow-sm" />
                  )}
                </div>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                  disabled={isLoading || isAnalyzingImage}
                />
              </label>
            </div>
          </div>
          
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6"
              >
                <ProgressStepper activeStep={activeStep} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonCard key={`skeleton-${index}`} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Summary
                </h3>
                <p className="text-neutral-700 leading-relaxed">{result.summary}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-left">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Offers</p>
                    <p className="text-lg font-semibold text-neutral-900">{filteredRecommendations.length}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-left">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Avg confidence</p>
                    <p className="text-lg font-semibold text-neutral-900">{avgConfidence}%</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-left">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Watchlist</p>
                    <p className="text-lg font-semibold text-neutral-900">{watchlist.length}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-left">
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500">Updated</p>
                    <p className="text-lg font-semibold text-neutral-900">Now</p>
                  </div>
                </div>
              </div>

              {(!result.recommendations || result.recommendations.length === 0) ? (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-amber-800 mb-2">No Stores Found in {region}</h3>
                  <p className="text-amber-700">We couldn't find any stores that sell this product and ship to your selected region. Try changing the region to "Global" or searching for a different product.</p>
                </div>
              ) : (
                <>
                  <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-700 font-medium shrink-0">
                  <Filter className="w-5 h-5" />
                  Filters
                </div>
                <div className="flex flex-wrap gap-3 w-full sm:w-auto justify-end">
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
                    <span className="text-sm text-neutral-500">Max Price:</span>
                    <input 
                      type="number" 
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(e.target.value === '' ? '' : Number(e.target.value));
                        analytics.trackFilterUsage('price');
                      }}
                      placeholder="Any"
                      className="w-20 bg-transparent border-none focus:ring-0 text-sm p-0 outline-none"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
                    <span className="text-sm text-neutral-500">Store:</span>
                    <select 
                      value={selectedStore}
                      onChange={(e) => {
                        setSelectedStore(e.target.value);
                        analytics.trackFilterUsage('store');
                      }}
                      className="bg-transparent border-none focus:ring-0 text-sm p-0 pr-2 cursor-pointer outline-none"
                    >
                      <option value="All">All Stores</option>
                      {uniqueStores.map(store => (
                        <option key={store} value={store}>{store}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
                    <span className="text-sm text-neutral-500">Min Rating:</span>
                    <select 
                      value={minRating}
                      onChange={(e) => {
                        setMinRating(Number(e.target.value));
                        analytics.trackFilterUsage('rating');
                      }}
                      className="bg-transparent border-none focus:ring-0 text-sm p-0 pr-2 cursor-pointer outline-none"
                    >
                      <option value={0}>Any</option>
                      <option value={3}>3+ Stars</option>
                      <option value={4}>4+ Stars</option>
                      <option value={4.5}>4.5+ Stars</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center bg-neutral-100 rounded-xl p-1 border border-neutral-200 ml-2">
                    <button
                      onClick={() => {
                        setViewMode('cards');
                        analytics.trackViewModeSwitch('cards');
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      Cards
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('table');
                        analytics.trackViewModeSwitch('table');
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      Compare
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (watchlist.length > 0) {
                        analytics.trackWatchlistAction('remove', 'bulk_clear');
                      }
                      setWatchlist([]);
                    }}
                    disabled={watchlist.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-medium text-neutral-700 disabled:opacity-40"
                  >
                    <Heart className="w-4 h-4" />
                    Clear watchlist
                  </button>
                </div>
              </div>

              {watchedRecommendations.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-rose-800 text-sm font-semibold">
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    Watchlist active ({watchedRecommendations.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {watchedRecommendations.slice(0, 4).map((rec, idx) => (
                      <button
                        key={`${getRecommendationKey(rec)}-${idx}`}
                        onClick={() => setActiveRecommendation(rec)}
                        className="text-xs px-2.5 py-1 rounded-full bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors"
                      >
                        {rec.storeName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredRecommendations.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200 shadow-sm">
                  <p className="text-neutral-500">No results match your filters.</p>
                  <button 
                    onClick={() => {
                      setMaxPrice('');
                      setSelectedStore('All');
                      setMinRating(0);
                      analytics.trackFilterUsage('price');
                      analytics.trackFilterUsage('store');
                      analytics.trackFilterUsage('rating');
                    }} 
                    className="mt-4 text-indigo-600 font-medium hover:underline"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : viewMode === 'table' ? (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200">
                          <th 
                            className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                            onClick={() => handleSort('Product & Store')}
                          >
                            <div className="flex items-center gap-1.5">Product & Store <SortIcon columnKey="Product & Store" /></div>
                          </th>
                          <th 
                            className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                            onClick={() => handleSort('Price')}
                          >
                            <div className="flex items-center gap-1.5">Price <SortIcon columnKey="Price" /></div>
                          </th>
                          <th 
                            className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                            onClick={() => handleSort('Rating')}
                          >
                            <div className="flex items-center gap-1.5">Rating <SortIcon columnKey="Rating" /></div>
                          </th>
                          {allSpecKeys.map(key => (
                            <th 
                              key={key} 
                              className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                              onClick={() => handleSort(key)}
                            >
                              <div className="flex items-center gap-1.5">{key} <SortIcon columnKey={key} /></div>
                            </th>
                          ))}
                          <th className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {sortedRecommendations.map((rec, i) => (
                          <tr key={i} className={`hover:bg-neutral-50/50 transition-colors ${rec.isBest ? 'bg-indigo-50/30' : ''}`}>
                            <td className="p-4 min-w-[250px]">
                              {rec.isBest && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 mb-2">
                                  <Star className="w-3 h-3 fill-indigo-700" /> Top Pick
                                </div>
                              )}
                              <div className="font-bold text-neutral-900 line-clamp-2" title={rec.productName}>{rec.productName || rec.storeName}</div>
                              <div className="text-sm text-neutral-500 mt-1">{rec.storeName}</div>
                            </td>
                            <td className="p-4 font-bold text-emerald-600 whitespace-nowrap text-lg">{rec.price}</td>
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                <span className="font-semibold text-neutral-900">{rec.ratingScore}</span>
                              </div>
                              <span className={`inline-flex mt-2 items-center px-2 py-0.5 text-[11px] border rounded-full font-semibold ${getConfidenceTone(getDealConfidence(rec))}`}>
                                {getDealConfidence(rec)}% confidence
                              </span>
                            </td>
                            {allSpecKeys.map(key => {
                              const spec = (rec.specifications || []).find(s => s.feature === key);
                              return (
                                <td key={key} className="p-4 text-neutral-700 text-sm min-w-[120px]">
                                  {spec ? spec.value : <span className="text-neutral-300 italic">-</span>}
                                </td>
                              );
                            })}
                            <td className="p-4">
                              {getDirectRecommendationHref(rec) && (
                                <a
                                  href={getDirectRecommendationHref(rec)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-medium border border-neutral-200 text-neutral-700 hover:bg-neutral-50 whitespace-nowrap mr-2"
                                >
                                  Try Direct
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <a
                                href={getRecommendationHref(rec)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                                  rec.isBest 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                    : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
                                }`}
                              >
                                Open
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              {(!rec.url || rec.url.trim() === '') && (
                                <div className="text-[11px] text-neutral-500 mt-1">Fallback link</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRecommendations.map((rec, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 30 }}
                      className={`relative flex flex-col rounded-2xl border overflow-hidden ${
                        rec.isBest
                          ? 'bg-gradient-to-br from-indigo-50 via-white to-indigo-50 border-indigo-400 shadow-lg ring-2 ring-indigo-300'
                          : 'bg-white border-neutral-200 shadow-sm'
                      }`}
                    >
                      {rec.isBest && (
                        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md">
                          <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                          Top Recommendation
                          <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                        </div>
                      )}
                      
                      <div className={`relative h-44 bg-neutral-100 border-b overflow-hidden flex items-center justify-center ${rec.isBest ? 'border-indigo-200' : 'border-neutral-200'}`}>
                        <img
                          src={rec.imageUrl || PLACEHOLDER_IMAGE}
                          alt={rec.productName || rec.storeName}
                          className="w-full h-full object-contain p-3"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            const target = event.currentTarget;
                            target.onerror = null;
                            target.src = PLACEHOLDER_IMAGE;
                          }}
                        />
                        
                        {/* Stock Status Badge */}
                        {rec.stockStatus && rec.stockStatus !== 'Unknown' && (
                          <div className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 ${
                            rec.stockStatus.toLowerCase().includes('out') ? 'bg-red-100 text-red-700' :
                            rec.stockStatus.toLowerCase().includes('pre') ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            <Package className="w-3.5 h-3.5" />
                            {rec.stockStatus}
                          </div>
                        )}
                      </div>
                      
                      <div className={`p-5 flex-1 flex flex-col ${rec.isBest ? 'pt-8' : ''}`}>
                        <div className="grid grid-cols-[1fr_auto] items-start gap-3 mb-4">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Store</p>
                            <h4 className="text-base font-bold text-neutral-900 line-clamp-2 min-w-0 leading-tight">{rec.storeName}</h4>
                          </div>
                          <div className="text-right min-w-0 max-w-[10.75rem]">
                            <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg block leading-tight line-clamp-2 text-center sm:text-right break-words">
                              {toCompactPriceLabel(rec.price)}
                            </span>
                            {rec.shippingInfo && rec.shippingInfo !== 'Unknown' && (
                              <div className="flex items-start justify-end gap-1 mt-2 text-xs font-medium text-neutral-500">
                                <Truck className="w-3.5 h-3.5" />
                                <span className="max-w-[9.25rem] line-clamp-2 break-words text-right">{rec.shippingInfo}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 text-[11px] border rounded-full font-semibold ${getConfidenceTone(getDealConfidence(rec))}`}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                            {getDealConfidence(rec)}% confidence
                          </span>
                          <span className="inline-flex items-center text-[11px] text-neutral-500 font-medium">
                            <Clock3 className="w-3.5 h-3.5 mr-1" />
                            updated now
                          </span>
                        </div>

                        {rec.bestReason && (
                          <div className={`mb-4 p-3 rounded-xl border ${
                            rec.isBest
                              ? 'bg-indigo-50 border-indigo-200'
                              : 'bg-amber-50 border-amber-200'
                          }`}>
                            <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${rec.isBest ? 'text-indigo-700' : 'text-amber-700'}`}>
                              Why this deal
                            </p>
                            <p className={`text-sm leading-snug ${rec.isBest ? 'text-indigo-900 font-medium' : 'text-amber-900'}`}>
                              {rec.bestReason}
                            </p>
                          </div>
                        )}

                        <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Price Trend (12 checkpoints)</p>
                            <span className="text-[11px] font-semibold text-emerald-700">Low-volatility</span>
                          </div>
                          <svg viewBox="0 0 180 44" className="w-full h-11">
                            <path
                              d={sparklinePath(buildPriceHistory(rec.priceValue, getRecommendationKey(rec)), 180, 44)}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              className="text-slate-700"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>

                        <div className="mb-4 flex-1">
                          <div className="flex items-center gap-1 mb-2">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="text-sm font-medium text-neutral-700">{rec.ratingScore}/5</span>
                          </div>
                          <p className="text-xs text-neutral-600 mb-3 leading-relaxed line-clamp-2">{rec.serviceRating}</p>
                          
                          {rec.productName && (
                            <div className="mb-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Product</p>
                              <p className="text-sm font-semibold text-neutral-900 line-clamp-2 leading-snug" title={rec.productName}>
                                {rec.productName}
                              </p>
                            </div>
                          )}
                          
                          {rec.specifications && rec.specifications.length > 0 && (
                            <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                              <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2">Key Specs</p>
                              <ul className="space-y-1.5">
                                {rec.specifications.slice(0, 3).map((spec, i) => (
                                  <li key={i} className="flex items-start justify-between gap-2 text-xs">
                                    <span className="font-medium text-slate-700">{spec.feature}:</span>
                                    <span className="text-slate-600 text-right line-clamp-1">{spec.value}</span>
                                  </li>
                                ))}
                              </ul>
                              {rec.specifications.length > 3 && (
                                <p className="text-[10px] text-slate-600 mt-1.5 font-medium">+{rec.specifications.length - 3} more specs</p>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100">
                              <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">Pros</h5>
                              <ul className="space-y-1">
                                {rec.pros.slice(0, 2).map((pro, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-700 leading-snug">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{pro}</span>
                                  </li>
                                ))}
                              </ul>
                              {rec.pros.length > 2 && <p className="text-[10px] text-emerald-700 mt-1.5 font-semibold">+{rec.pros.length - 2} more</p>}
                            </div>

                            <div className="bg-rose-50/50 rounded-lg p-2.5 border border-rose-100">
                              <h5 className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1.5">Cons</h5>
                              <ul className="space-y-1">
                                {rec.cons.slice(0, 2).map((con, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-700 leading-snug">
                                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{con}</span>
                                  </li>
                                ))}
                              </ul>
                              {rec.cons.length > 2 && <p className="text-[10px] text-rose-700 mt-1.5 font-semibold">+{rec.cons.length - 2} more</p>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto p-4 pt-0 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setActiveRecommendation(rec)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl font-medium bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition-colors"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => toggleWatchlist(rec)}
                          className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl font-medium transition-colors border ${watchlist.includes(getRecommendationKey(rec)) ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50'}`}
                        >
                          <Heart className={`w-4 h-4 ${watchlist.includes(getRecommendationKey(rec)) ? 'fill-rose-600 text-rose-600' : ''}`} />
                          {watchlist.includes(getRecommendationKey(rec)) ? 'Watching' : 'Watch'}
                        </button>
                      </div>
                      <div className="px-4 pb-3">
                        <a
                          href={getRecommendationHref(rec)}
                          onClick={() => analytics.trackDealClick(rec.storeName, rec.isBest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl font-medium transition-colors ${
                            rec.isBest
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-neutral-900 text-white hover:bg-neutral-800'
                          }`}
                        >
                          Open Deal
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      {getDirectRecommendationHref(rec) && (
                        <div className="px-5 pb-2">
                          <a
                            href={getDirectRecommendationHref(rec)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline"
                          >
                            Try direct product URL
                          </a>
                        </div>
                      )}
                      {(!rec.url || rec.url.trim() === '') && (
                        <div className="px-5 pb-4 text-xs text-neutral-500">Fallback link generated from store domain.</div>
                      )}
                  </motion.div>
                ))}
              </div>
            )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeRecommendation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] p-4 sm:p-6 lg:p-8"
              onClick={() => setActiveRecommendation(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto bg-white rounded-2xl border border-neutral-200 shadow-xl max-h-[90vh] overflow-y-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="p-5 sm:p-6 border-b border-neutral-200 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900">{activeRecommendation.storeName}</h3>
                    <p className="text-sm text-neutral-600 mt-1">{activeRecommendation.productName || 'Product details'}</p>
                  </div>
                  <button
                    onClick={() => setActiveRecommendation(null)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 hover:bg-neutral-200"
                  >
                    Close
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  <div className="rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
                    <img
                      src={activeRecommendation.imageUrl || PLACEHOLDER_IMAGE}
                      alt={activeRecommendation.productName || activeRecommendation.storeName}
                      className="w-full h-64 object-contain p-4"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        const target = event.currentTarget;
                        target.onerror = null;
                        target.src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-neutral-200 p-3">
                      <p className="text-xs text-neutral-500 uppercase tracking-wide">Price</p>
                      <p className="text-lg font-semibold text-emerald-600">{activeRecommendation.price}</p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-3">
                      <p className="text-xs text-neutral-500 uppercase tracking-wide">Rating</p>
                      <p className="text-lg font-semibold text-neutral-900">{activeRecommendation.ratingScore}/5</p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 p-3">
                      <p className="text-xs text-neutral-500 uppercase tracking-wide">Shipping</p>
                      <p className="text-sm font-medium text-neutral-900 line-clamp-2">{activeRecommendation.shippingInfo || 'Unknown'}</p>
                    </div>
                  </div>

                  {activeRecommendation.specifications.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-800 mb-2">Specifications</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeRecommendation.specifications.map((spec, index) => (
                          <div key={index} className="rounded-lg border border-neutral-200 p-2.5 text-sm">
                            <span className="text-neutral-500">{spec.feature}: </span>
                            <span className="text-neutral-900 font-medium">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                      <h4 className="text-sm font-semibold text-emerald-700 mb-2">Pros</h4>
                      <ul className="space-y-1.5">
                        {activeRecommendation.pros.length > 0 ? (
                          activeRecommendation.pros.map((pro, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-neutral-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{pro}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-neutral-500">No pros provided.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                      <h4 className="text-sm font-semibold text-rose-700 mb-2">Cons</h4>
                      <ul className="space-y-1.5">
                        {activeRecommendation.cons.length > 0 ? (
                          activeRecommendation.cons.map((con, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-neutral-800">
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              <span>{con}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-neutral-500">No cons provided.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <a
                    href={getRecommendationHref(activeRecommendation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    Open Store Results
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {getDirectRecommendationHref(activeRecommendation) && (
                    <a
                      href={getDirectRecommendationHref(activeRecommendation)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Try Direct Product URL
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
