// File role: Sortable table view for side-by-side recommendation comparison.
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink, Star } from 'lucide-react';
import { type Recommendation } from '../shared/searchSchema';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface ComparisonTableProps {
  sortedRecommendations: Recommendation[];
  allSpecKeys: string[];
  sortConfig: SortConfig | null;
  onSort: (key: string) => void;
  getConfidence: (rec: Recommendation) => number;
  getConfidenceTone: (score: number) => string;
  getRecommendationHref: (rec: Recommendation) => string;
  getDirectHref: (rec: Recommendation) => string;
}

/**
 * Comparison Table so this file stays easier to maintain for the next developer.
 *
 * @param { sortedRecommendations, allSpecKeys, sortConfig, onSort, getConfidence, getConfidenceTone, getRecommendationHref, getDirectHref, } - { sortedRecommendations, allSpecKeys, sortConfig, onSort, getConfidence, getConfidenceTone, getRecommendationHref, getDirectHref, } provided by the caller to control this behavior.
 * @returns Nothing meaningful; this function exists for side effects and flow control.
 */
export default function ComparisonTable({
  sortedRecommendations,
  allSpecKeys,
  sortConfig,
  onSort,
  getConfidence,
  getConfidenceTone,
  getRecommendationHref,
  getDirectHref,
}: ComparisonTableProps) {
  /**
   * Sort Icon so this file stays easier to maintain for the next developer.
   *
   * @param columnKey - columnKey provided by the caller to control this behavior.
   * @returns Nothing meaningful; this function exists for side effects and flow control.
   */

  const sortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4 text-indigo-600" />
      : <ChevronDown className="w-4 h-4 text-indigo-600" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th
                className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                onClick={() => onSort('Product & Store')}
              >
                <div className="flex items-center gap-1.5">Product & Store {sortIcon('Product & Store')}</div>
              </th>
              <th
                className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                onClick={() => onSort('Price')}
              >
                <div className="flex items-center gap-1.5">Price {sortIcon('Price')}</div>
              </th>
              <th
                className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                onClick={() => onSort('Rating')}
              >
                <div className="flex items-center gap-1.5">Rating {sortIcon('Rating')}</div>
              </th>
              {allSpecKeys.map((key) => (
                <th
                  key={key}
                  className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap cursor-pointer hover:bg-neutral-100 transition-colors group select-none"
                  onClick={() => onSort(key)}
                >
                  <div className="flex items-center gap-1.5">{key} {sortIcon(key)}</div>
                </th>
              ))}
              <th className="p-4 font-semibold text-neutral-600 text-sm whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedRecommendations.map((rec, index) => (
              <tr key={index} className={`hover:bg-neutral-50/50 transition-colors ${rec.isBest ? 'bg-indigo-50/30' : ''}`}>
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
                  <div className="relative group inline-flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-semibold text-neutral-900">{rec.ratingScore}</span>
                    <div className="absolute left-0 bottom-full mb-2 w-72 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-md invisible opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 pointer-events-none z-20">
                      Rating estimated by AI based on public web reviews - not from Trustpilot or Google Reviews
                    </div>
                  </div>
                  <span className={`inline-flex mt-2 items-center px-2 py-0.5 text-[11px] border rounded-full font-semibold ${getConfidenceTone(getConfidence(rec))}`}>
                    {getConfidence(rec)}% confidence
                  </span>
                </td>
                {allSpecKeys.map((key) => {
                  const spec = (rec.specifications || []).find((item) => item.feature === key);
                  return (
                    <td key={key} className="p-4 text-neutral-700 text-sm min-w-[120px]">
                      {spec ? spec.value : <span className="text-neutral-300 italic">-</span>}
                    </td>
                  );
                })}
                <td className="p-4">
                  {getDirectHref(rec) && (
                    <a
                      href={getDirectHref(rec)}
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
  );
}

