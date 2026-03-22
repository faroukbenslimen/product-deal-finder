// File role: Search input and region selection form with inline validation UI.
import { FormEvent } from 'react';
import { Search, Globe, ChevronDown, Loader2 } from 'lucide-react';

interface SearchBarProps {
  query: string;
  region: string;
  regions: string[];
  isLoading: boolean;
  queryValidationError: string | null;
  onQueryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

/**
 * Search Bar so this file stays easier to maintain for the next developer.
 *
 * @param { query, region, regions, isLoading, queryValidationError, onQueryChange, onRegionChange, onSubmit, } - { query, region, regions, isLoading, queryValidationError, onQueryChange, onRegionChange, onSubmit, } provided by the caller to control this behavior.
 * @returns Nothing meaningful; this function exists for side effects and flow control.
 */
export default function SearchBar({
  query,
  region,
  regions,
  isLoading,
  queryValidationError,
  onQueryChange,
  onRegionChange,
  onSubmit,
}: SearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="e.g., Sony WH-1000XM5 headphones"
            className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-300 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg transition-shadow"
            disabled={isLoading}
          />
          {queryValidationError && (
            <p className="text-sm text-red-500 mt-1 text-left">{queryValidationError}</p>
          )}
        </div>

        <div className="relative sm:w-48 shrink-0">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <select
            value={region}
            onChange={(event) => onRegionChange(event.target.value)}
            className="w-full pl-12 pr-10 py-4 bg-white border border-neutral-300 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg appearance-none cursor-pointer"
            disabled={isLoading}
          >
            {regions.map((regionValue) => (
              <option key={regionValue} value={regionValue}>
                {regionValue}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
        </div>

        <button
          type="submit"
          disabled={isLoading || query.trim().length < 3}
          className="px-8 py-4 bg-[linear-gradient(120deg,#0f172a,#1e293b)] text-white font-medium rounded-2xl hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center min-w-[120px]"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
        </button>
      </div>
      <p className="text-xs text-neutral-500 mt-1 text-center sm:text-left">
        Regional availability is AI-estimated and may not be 100% accurate.
      </p>
    </form>
  );
}

