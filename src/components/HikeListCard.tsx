import Link from 'next/link';

export type HikeListCardProps = {
  slug: string;
  name: string;
  region?: string;
  distanceKm?: number;
  ascentM?: number;
  difficulty?: 'easy' | 'moderate' | 'hard';
  themeTags?: string[]; // e.g. ['coastal', 'waterfalls', 'ridges']
  transportTags?: string[]; // e.g. ['train-accessible', 'bus-accessible', 'car-free-possible'];
  thumbnailUrl?: string;
};

const difficultyColours: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-amber-100 text-amber-800',
  hard: 'bg-rose-100 text-rose-800',
};

export function HikeListCard({
  slug,
  name,
  region,
  distanceKm,
  ascentM,
  difficulty,
  themeTags = [],
  transportTags = [],
  thumbnailUrl,
}: HikeListCardProps) {
  return (
    <article className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md sm:p-4">
      {/* Thumbnail */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-32">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No photo
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              href={`/hike/${slug}`}
              className="text-sm font-semibold text-slate-900 hover:underline sm:text-base"
            >
              {name}
            </Link>
            {region && (
              <p className="text-xs text-slate-500 sm:text-sm">{region}</p>
            )}
          </div>

          {difficulty && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide sm:text-xs ${
                difficultyColours[difficulty] ?? 'bg-slate-100 text-slate-700'
              }`}
            >
              {difficulty}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 sm:text-sm">
          {typeof distanceKm === 'number' && (
            <span>{distanceKm.toFixed(1)} km</span>
          )}
          {typeof ascentM === 'number' && <span>{ascentM} m ascent</span>}
        </div>

        {/* Tags row */}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {themeTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 sm:text-xs"
            >
              {tag}
            </span>
          ))}

          {transportTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 sm:text-xs"
            >
              {tag === 'train-accessible' && '🚆 Train'}
              {tag === 'bus-accessible' && '🚌 Bus'}
              {tag === 'car-free-possible' && '🚶 Car-free'}
              {!['train-accessible', 'bus-accessible', 'car-free-possible'].includes(
                tag,
              ) && tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
