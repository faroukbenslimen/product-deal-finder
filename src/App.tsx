// File role: Top-level page composition for search, filters, and result presentation.
import { type DragEvent as ReactDragEvent, useEffect, useState } from 'react';
import { ShoppingBag, Star, AlertCircle, Filter, Camera, Heart, TrendingUp, ShieldCheck } from 'lucide-react';
// Keep motion/react: this screen relies on coordinated enter/exit transitions and staggered card animations.
import { motion, AnimatePresence } from 'motion/react';
import { REGIONS } from './constants';
import { type SearchResult } from './shared/searchSchema';
import { getDirectRecommendationHref, getReliableRecommendationHref } from './utils/linkUtils';
import { analytics } from './analytics';
import ProgressStepper from './components/ProgressStepper';
import SkeletonCard from './components/SkeletonCard';
import SearchBar from './components/SearchBar';
import FilterBar from './components/FilterBar';
import ResultCard from './components/ResultCard';
import ComparisonTable from './components/ComparisonTable';
import RecommendationModal from './components/RecommendationModal';
import { useProductSearch } from './hooks/useProductSearch';

const PLACEHOLDER_IMAGE = 'https://placehold.co/640x420/e5e7eb/6b7280?text=No+Image';

/**
 * Gets Recommendation Key.
 *
 * @param rec - recsupplied by the caller.
 * @returns The computed value this helper produces for downstream logic.
 */
function getRecommendationKey(rec: SearchResult['recommendations'][number]): string {
  const urlPart = rec.url?.trim() || rec.domain?.trim() || 'unknown';
  return `${rec.storeName}-${rec.productName}-${urlPart}`.toLowerCase();
}

/**
 * Gets Deal Confidence.
 *
 * @param rec - recsupplied by the caller.
 * @returns The computed value this helper produces for downstream logic.
 */
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

/**
 * Gets Confidence Tone.
 *
 * @param score - scoresupplied by the caller.
 * @returns The computed value this helper produces for downstream logic.
 */
function getConfidenceTone(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

/**
 * App so this code stays predictable and easier to maintain.
 *
 * @returnsVoid.
 */
export default function App() {
  const {
    query,
    setQuery,
    region,
    setRegion,
    isLoading,
    activeStep,
    result,
    error,
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
  } = useProductSearch();

  // Table view toggle
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeRecommendation, setActiveRecommendation] = useState<SearchResult['recommendations'][number] | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (isLoading) {
      setWatchlist([]);
      setActiveRecommendation(null);
    }
  }, [isLoading]);

  /**
   * Handles Sort.
   *
   * @param key - keysupplied by the caller.
   * @returnsVoid.
   */


  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };


  /**
   * Handles Drag Drop.
   *
   * @param e - esupplied by the caller.
   * @returnsVoid.
   */



  const handleDragDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = (e.dataTransfer as DataTransfer).files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  /**
   * Handles Drag Over.
   *
   * @param e - esupplied by the caller.
   * @returnsVoid.
   */


  const handleDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

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
    let aValue: string | number;
    let bValue: string | number;

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

  /**
   * Gets Recommendation Href.
   *
   * @param rec - recsupplied by the caller.
   * @returns The computed value this helper produces for downstream logic.
   */


  const getRecommendationHref = (rec: SearchResult['recommendations'][number]) => getReliableRecommendationHref(rec, query);

  /**
   * Toggles Watchlist.
   *
   * @param rec - recsupplied by the caller.
   * @returns The computed value this helper produces for downstream logic.
   */


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
            {result && (
              <button
                onClick={() => {
                  startNewSearch();
                  setViewMode('cards');
                  setActiveRecommendation(null);
                  setWatchlist([]);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-full border border-neutral-300 bg-white text-neutral-700 font-semibold hover:bg-neutral-50 transition-colors"
              >
                New Search
              </button>
            )}
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

          <SearchBar
            query={query}
            region={region}
            regions={REGIONS}
            isLoading={isLoading}
            queryValidationError={queryValidationError}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery);
              if (nextQuery.trim().length >= 3) {
                setQueryValidationError(null);
              }
            }}
            onRegionChange={setRegion}
            onSubmit={handleSearch}
          />

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
                  <div className="px-1">
                    <p className="text-xl font-semibold text-neutral-800">
                      Found {result.recommendations.length} stores selling '{query}' in {region}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-neutral-700 font-medium shrink-0 px-1">
                      <Filter className="w-5 h-5" />
                      Filters
                    </div>
                    <FilterBar
                      maxPrice={maxPrice}
                      selectedStore={selectedStore}
                      minRating={minRating}
                      uniqueStores={uniqueStores}
                      detectedCurrency={detectedCurrency}
                      onMaxPriceChange={(value) => {
                        setMaxPrice(value);
                        analytics.trackFilterUsage('price');
                      }}
                      onStoreChange={(value) => {
                        setSelectedStore(value);
                        analytics.trackFilterUsage('store');
                      }}
                      onMinRatingChange={(value) => {
                        setMinRating(value);
                        analytics.trackFilterUsage('rating');
                      }}
                    />

                    <div className="flex flex-wrap gap-3 justify-end">
                      <div className="flex items-center bg-neutral-100 rounded-xl p-1 border border-neutral-200">
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
                  <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                  <p className="text-neutral-600 font-medium">No stores match your filters</p>
                  <button 
                    onClick={() => {
                      clearFilters();
                      analytics.trackFilterUsage('price');
                      analytics.trackFilterUsage('store');
                      analytics.trackFilterUsage('rating');
                    }} 
                    className="mt-4 text-indigo-600 font-medium hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : viewMode === 'table' ? (
                <ComparisonTable
                  sortedRecommendations={sortedRecommendations}
                  allSpecKeys={allSpecKeys}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  getConfidence={getDealConfidence}
                  getConfidenceTone={getConfidenceTone}
                  getRecommendationHref={getRecommendationHref}
                  getDirectHref={getDirectRecommendationHref}
                />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRecommendations.map((rec, index) => {
                    const recommendationHref = getRecommendationHref(rec);

                    return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 30 }}
                    >
                      <ResultCard
                        rec={rec}
                        placeholderImage={PLACEHOLDER_IMAGE}
                        confidence={getDealConfidence(rec)}
                        confidenceTone={getConfidenceTone(getDealConfidence(rec))}
                        recommendationHref={recommendationHref}
                        directHref={getDirectRecommendationHref(rec)}
                        isWatched={watchlist.includes(getRecommendationKey(rec))}
                        onOpenDetails={() => setActiveRecommendation(rec)}
                        onToggleWatchlist={() => toggleWatchlist(rec)}
                        onDealClick={() => analytics.trackDealClick(rec.storeName, rec.isBest)}
                      />
                  </motion.div>
                  );
                })}
              </div>
            )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <RecommendationModal
          recommendation={activeRecommendation}
          placeholderImage={PLACEHOLDER_IMAGE}
          getRecommendationHref={getRecommendationHref}
          getDirectHref={getDirectRecommendationHref}
          onClose={() => setActiveRecommendation(null)}
        />

        <footer className="text-xs text-neutral-400 text-center py-8">
          Results are AI-generated and unsponsored. Prices and availability may vary.
        </footer>
      </main>
    </div>
  );
}

