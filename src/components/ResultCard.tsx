// File role: Individual recommendation card with pricing, trust, and CTA actions.
import { CheckCircle2, Clock3, ExternalLink, Heart, Package, ShieldCheck, Star, Truck, XCircle } from 'lucide-react';
import { type Recommendation } from '../shared/searchSchema';

interface ResultCardProps {
  rec: Recommendation;
  placeholderImage: string;
  confidence: number;
  confidenceTone: string;
  recommendationHref: string;
  directHref: string;
  isWatched: boolean;
  onOpenDetails: () => void;
  onToggleWatchlist: () => void;
  onDealClick: () => void;
}

/**
 * To Compact Price Label.
 *
 * @param price - pricesupplied by the caller.
 * @returns The computed value this helper produces for downstream logic.
 */
function toCompactPriceLabel(price: string): string {
  const normalized = price.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 28) return normalized;

  const withoutParentheses = normalized.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (withoutParentheses.length <= 28) return withoutParentheses;

  return `${withoutParentheses.slice(0, 25)}...`;
}

/**
 * Result Card.
 *
 * @param { rec, placeholderImage, confidence, confidenceTone, recommendationHref, directHref, isWatched, onOpenDetails, onToggleWatchlist, onDealClick, } - { rec, placeholderImage, confidence, confidenceTone, recommendationHref, directHref, isWatched, onOpenDetails, onToggleWatchlist, onDealClick, }supplied by the caller.
 * @returnsVoid.
 */
export default function ResultCard({
  rec,
  placeholderImage,
  confidence,
  confidenceTone,
  recommendationHref,
  directHref,
  isWatched,
  onOpenDetails,
  onToggleWatchlist,
  onDealClick,
}: ResultCardProps) {
  const isFallbackLink = recommendationHref.includes('google.com/search');

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
        rec.isBest
          ? 'bg-gradient-to-br from-indigo-50 via-white to-indigo-50 border-indigo-400 shadow-lg ring-2 ring-indigo-300 border-l-4 border-indigo-600 hover:scale-105 transition-transform'
          : 'bg-white border-neutral-200 shadow-sm'
      }`}
    >
      {rec.isBest && (
        <div className="absolute top-3 right-3 z-10 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-full">
          â­ Best Pick
        </div>
      )}

      <div
        className={`relative h-44 border-b overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_50%_18%,#ffffff_0%,#eef2f7_55%,#e2e8f0_100%)] ${rec.isBest ? 'border-indigo-200' : 'border-neutral-200'}`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.75),rgba(248,250,252,0.15)_45%,rgba(226,232,240,0.35))]" />
        <div className="absolute left-1/2 bottom-3 h-5 w-2/3 -translate-x-1/2 rounded-full bg-slate-900/12 blur-md" />
        <div className="relative z-[1] m-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] rounded-xl border border-white/80 bg-white/70 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.85)] backdrop-blur-[1px] flex items-center justify-center overflow-hidden">
          <img
            src={rec.imageUrl || placeholderImage}
            alt={rec.productName || rec.storeName}
            className="w-full h-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-[1.02]"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const target = event.currentTarget;
              target.onerror = null;
              target.src = placeholderImage;
            }}
          />
        </div>

        {rec.stockStatus && rec.stockStatus !== 'Unknown' && (
          <div className={`absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 ${
            rec.stockStatus.toLowerCase().includes('out')
              ? 'bg-red-100 text-red-700'
              : rec.stockStatus.toLowerCase().includes('pre')
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
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
            <h4 className="text-lg font-semibold text-neutral-900 line-clamp-2 min-w-0 leading-tight">{rec.storeName}</h4>
            {rec.isBest && rec.bestReason && (
              <p className="mt-1 text-xs italic text-indigo-600 line-clamp-2">{rec.bestReason}</p>
            )}
          </div>
          <div className="text-right min-w-0 max-w-[10.75rem]">
            <span className="text-2xl font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg block leading-tight line-clamp-2 text-center sm:text-right break-words">
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
          <span className={`inline-flex items-center px-2.5 py-1 text-[11px] border rounded-full font-semibold ${confidenceTone}`}>
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            {confidence}% confidence
          </span>
          <span className="inline-flex items-center text-[11px] text-neutral-500 font-medium">
            <Clock3 className="w-3.5 h-3.5 mr-1" />
            updated now
          </span>
        </div>

        <div className="mb-4 flex-1">
          <div className="relative group inline-flex items-center gap-1 mb-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium text-neutral-700">{rec.ratingScore}/5</span>
            <div className="absolute left-0 bottom-full mb-2 w-72 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-md invisible opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 pointer-events-none z-20">
              Rating estimated by AI based on public web reviews - not from Trustpilot or Google Reviews
            </div>
          </div>
          <p className="text-sm text-neutral-500 mb-3 leading-relaxed line-clamp-2">{rec.serviceRating}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100">
              <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">Pros</h5>
              <ul className="space-y-1">
                {rec.pros.slice(0, 2).map((pro, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-xs text-neutral-700 leading-snug">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-rose-50/50 rounded-lg p-2.5 border border-rose-100">
              <h5 className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1.5">Cons</h5>
              <ul className="space-y-1">
                {rec.cons.slice(0, 2).map((con, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-xs text-neutral-700 leading-snug">
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 pt-0 grid grid-cols-2 gap-2">
        <button
          onClick={onOpenDetails}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl font-medium bg-neutral-100 text-neutral-900 hover:bg-neutral-200 transition-colors"
        >
          Details
        </button>
        <button
          onClick={onToggleWatchlist}
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl font-medium transition-colors border ${
            isWatched ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWatched ? 'fill-rose-600 text-rose-600' : ''}`} />
          {isWatched ? 'Watching' : 'Watch'}
        </button>
      </div>

      <div className="px-4 pb-3">
        <a
          href={recommendationHref}
          onClick={onDealClick}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl font-medium transition-colors ${
            isFallbackLink
              ? 'border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isFallbackLink ? 'ðŸ” Search on Google' : 'View Deal'}
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {directHref && (
        <div className="px-5 pb-2">
          <a
            href={directHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline"
          >
            Try direct product URL
          </a>
        </div>
      )}
      {!rec.url?.trim() && (
        <div className="px-5 pb-4 text-xs text-neutral-500">Fallback link generated from store domain.</div>
      )}
    </div>
  );
}

