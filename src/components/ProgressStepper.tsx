// File role: Visual stepper that reflects staged progress during active search.
import { CheckCircle2, Circle } from 'lucide-react';
// Keep motion/react for per-step state transitions and icon swap animations that are not simple CSS fades.
import { motion, AnimatePresence } from 'motion/react';

interface ProgressStepperProps {
  activeStep: number;
}

// These labels map to staged search progress so users can see why loading takes time.
const STEPS = [
  'Searching the web',
  'Comparing prices',
  'Analyzing reviews',
  'Finalizing results',
];

/**
 * Progress Stepper so this file stays easier to maintain for the next developer.
 *
 * @param { activeStep } - { activeStep } provided by the caller to control this behavior.
 * @returns Nothing meaningful; this function exists for side effects and flow control.
 */
export default function ProgressStepper({ activeStep }: ProgressStepperProps) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-sm">
      <p className="text-sm font-semibold text-neutral-800 mb-3">Search Progress</p>
      <div className="space-y-2.5">
        {STEPS.map((step, index) => {
          const isCompleted = index < activeStep;
          const isActive = index === activeStep;
          const isPending = index > activeStep;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: isPending ? 0.45 : 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              className={`group grid grid-cols-[20px_1fr] items-center gap-3 transition-all duration-300 ${
                isPending ? 'opacity-45' : 'opacity-100'
              }`}
            >
              <div className="relative h-5 w-5 flex items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  {isCompleted ? (
                    <motion.span
                      key={`${step}-done`}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key={`${step}-pending`}
                      initial={{ scale: 0.9, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Circle className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-neutral-300'}`} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <p
                className={`text-sm transition-colors duration-300 ${
                  isCompleted ? 'text-emerald-700 font-medium' : isActive ? 'text-neutral-900 font-medium' : 'text-neutral-500'
                }`}
              >
                {step}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

