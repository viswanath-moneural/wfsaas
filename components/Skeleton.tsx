'use client'

interface SkeletonProps {
  width?:    string | number
  height?:   string | number
  radius?:   'sm' | 'md' | 'lg' | 'full'
  className?: string
}

export default function Skeleton({
  width,
  height    = 16,
  radius    = 'md',
  className = '',
}: SkeletonProps) {
  return (
    <>
      <style>{SKELETON_STYLES}</style>
      <span
        className={`skeleton skeleton--radius-${radius} ${className}`}
        style={{
          width:  width  !== undefined ? (typeof width  === 'number' ? `${width}px`  : width)  : '100%',
          height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        }}
        aria-hidden="true"
      />
    </>
  )
}

// Pre-built skeleton layouts for common patterns
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 && lines > 1 ? '65%' : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table">
      {/* Header */}
      <div className="skeleton-table__header">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} width={80} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="skeleton-table__row">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} height={14} width={colIdx === 0 ? 120 : '70%'} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card__header">
        <Skeleton height={40} width={40} radius="lg" />
        <div className="skeleton-card__header-text">
          <Skeleton height={14} width={120} />
          <Skeleton height={12} width={80} />
        </div>
      </div>
      <Skeleton height={32} />
      <Skeleton height={12} width="60%" />
    </div>
  )
}

const SKELETON_STYLES = `
.skeleton {
  display:    inline-block;
  background: linear-gradient(
    90deg,
    var(--color-gray-100) 25%,
    var(--color-gray-200) 50%,
    var(--color-gray-100) 75%
  );
  background-size: 200% 100%;
  animation:  shimmer 1.4s ease infinite;
}

.skeleton--radius-sm   { border-radius: var(--radius-sm); }
.skeleton--radius-md   { border-radius: var(--radius-md); }
.skeleton--radius-lg   { border-radius: var(--radius-lg); }
.skeleton--radius-full { border-radius: var(--radius-full); }

/* Skeleton text */
.skeleton-text {
  display:        flex;
  flex-direction: column;
  gap:            var(--space-2);
}

/* Skeleton table */
.skeleton-table {
  display:        flex;
  flex-direction: column;
}
.skeleton-table__header {
  display:         flex;
  gap:             var(--space-6);
  padding:         var(--space-3) var(--space-4);
  border-bottom:   1px solid var(--border-default);
}
.skeleton-table__row {
  display:       flex;
  gap:           var(--space-6);
  align-items:   center;
  padding:       var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

/* Skeleton card */
.skeleton-card {
  display:        flex;
  flex-direction: column;
  gap:            var(--space-4);
  padding:        var(--space-6);
  background:     var(--surface-card);
  border:         1px solid var(--border-default);
  border-radius:  var(--radius-lg);
}
.skeleton-card__header {
  display:     flex;
  align-items: center;
  gap:         var(--space-3);
}
.skeleton-card__header-text {
  display:        flex;
  flex-direction: column;
  gap:            var(--space-1-5);
  flex:           1;
}
`