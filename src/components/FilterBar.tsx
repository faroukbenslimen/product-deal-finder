// File role: Filter controls for price, store, and rating refinement.
interface FilterBarProps {
  maxPrice: number | '';
  selectedStore: string;
  minRating: number;
  uniqueStores: string[];
  detectedCurrency: string;
  onMaxPriceChange: (value: number | '') => void;
  onStoreChange: (value: string) => void;
  onMinRatingChange: (value: number) => void;
}

/**
 * Filter Bar.
 *
 * @param { maxPrice, selectedStore, minRating, uniqueStores, detectedCurrency, onMaxPriceChange, onStoreChange, onMinRatingChange, } - { maxPrice, selectedStore, minRating, uniqueStores, detectedCurrency, onMaxPriceChange, onStoreChange, onMinRatingChange, }supplied by the caller.
 * @returnsVoid.
 */
export default function FilterBar({
  maxPrice,
  selectedStore,
  minRating,
  uniqueStores,
  detectedCurrency,
  onMaxPriceChange,
  onStoreChange,
  onMinRatingChange,
}: FilterBarProps) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
      <div className="flex flex-wrap gap-3 w-full justify-end">
        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
          <span className="text-sm text-neutral-500">Max price ({detectedCurrency}):</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(event) => onMaxPriceChange(event.target.value === '' ? '' : Number(event.target.value))}
            placeholder={`Max price (${detectedCurrency})`}
            className="w-20 bg-transparent border-none focus:ring-0 text-sm p-0 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
          <span className="text-sm text-neutral-500">Store:</span>
          <select
            value={selectedStore}
            onChange={(event) => onStoreChange(event.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm p-0 pr-2 cursor-pointer outline-none"
          >
            <option value="All">All Stores</option>
            {uniqueStores.map((store) => (
              <option key={store} value={store}>
                {store}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
          <span className="text-sm text-neutral-500">Min Rating:</span>
          <select
            value={minRating}
            onChange={(event) => onMinRatingChange(Number(event.target.value))}
            className="bg-transparent border-none focus:ring-0 text-sm p-0 pr-2 cursor-pointer outline-none"
          >
            <option value={0}>Any</option>
            <option value={3}>3+ Stars</option>
            <option value={4}>4+ Stars</option>
            <option value={4.5}>4.5+ Stars</option>
          </select>
        </div>
      </div>
    </div>
  );
}

