// File role: Expanded recommendation detail modal with links and specifications.
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
// Keep motion/react here for modal mount/unmount choreography and backdrop/content synchronization.
import { motion, AnimatePresence } from 'motion/react';
import { type Recommendation } from '../shared/searchSchema';

interface RecommendationModalProps {
  recommendation: Recommendation | null;
  placeholderImage: string;
  getRecommendationHref: (rec: Recommendation) => string;
  getDirectHref: (rec: Recommendation) => string;
  onClose: () => void;
}

/**
 * Recommendation Modal.
 *
 * @param { recommendation, placeholderImage, getRecommendationHref, getDirectHref, onClose, } - Props supplied by the parent component.
 * @returns void
 */
export default function RecommendationModal({
  recommendation,
  placeholderImage,
  getRecommendationHref,
  getDirectHref,
  onClose,
}: RecommendationModalProps) {
  return (
    <AnimatePresence>
      {recommendation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] p-4 sm:p-6 lg:p-8"
          onClick={onClose}
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
                <h3 className="text-xl font-bold text-neutral-900">{recommendation.storeName}</h3>
                <p className="text-sm text-neutral-600 mt-1">{recommendation.productName || 'Product details'}</p>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-100 hover:bg-neutral-200"
              >
                Close
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
                <img
                  src={recommendation.imageUrl || placeholderImage}
                  alt={recommendation.productName || recommendation.storeName}
                  className="w-full h-64 object-contain p-4"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.onerror = null;
                    target.src = placeholderImage;
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Price</p>
                  <p className="text-lg font-semibold text-emerald-600">{recommendation.price}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Rating</p>
                  <p className="text-lg font-semibold text-neutral-900">{recommendation.ratingScore}/5</p>
                </div>
                <div className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Shipping</p>
                  <p className="text-sm font-medium text-neutral-900 line-clamp-2">{recommendation.shippingInfo || 'Unknown'}</p>
                </div>
              </div>

              {recommendation.specifications.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-800 mb-2">Specifications</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recommendation.specifications.map((spec, index) => (
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
                    {recommendation.pros.length > 0 ? (
                      recommendation.pros.map((pro, index) => (
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
                    {recommendation.cons.length > 0 ? (
                      recommendation.cons.map((con, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-neutral-800">
                          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
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
                href={getRecommendationHref(recommendation)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Open Store Results
                <ExternalLink className="w-4 h-4" />
              </a>

              {getDirectHref(recommendation) && (
                <a
                  href={getDirectHref(recommendation)}
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
  );
}

