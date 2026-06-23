import type { Format, RouteInfo } from './types';

// Full v1 design matrix. `supported: false` = deferred to v2.
export const ROUTES: RouteInfo[] = [
  { from: 'midi',     to: 'musicxml', engine: 'pyodide',  heavy: true,  lossy: false, supported: true  },
  { from: 'midi',     to: 'gp',       engine: 'pyodide',  heavy: true,  lossy: false, supported: true  },
  { from: 'musicxml', to: 'gp',       engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'musicxml', to: 'midi',     engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'gp',       to: 'midi',     engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'gp',       to: 'gp',       engine: 'alphatab', heavy: false, lossy: false, supported: true  },
  { from: 'gp',       to: 'musicxml', engine: 'pyodide',  heavy: true,  lossy: true,  supported: false }, // v2
];

export function routeKey(from: Format, to: Format): string {
  return `${from}>${to}`;
}
