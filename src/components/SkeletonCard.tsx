export default function SkeletonCard() {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="h-5 w-2/3 rounded bg-neutral-200 mb-3" />
      <div className="h-7 w-1/3 rounded bg-neutral-200 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 rounded-lg bg-neutral-200" />
        <div className="h-16 rounded-lg bg-neutral-200" />
      </div>
    </div>
  );
}
