export interface Interval {
  low: number;
  high: number;
}

export function wilson(successes: number, n: number, z = 1.959963984540054): Interval {
  if (n === 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  const center = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { low: successes === 0 ? 0 : Math.max(0, center - half), high: successes === n ? 1 : Math.min(1, center + half) };
}

function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

export function fisherExactTwoSided(a: number, b: number, c: number, d: number): number {
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  const logP = (x: number): number =>
    logFactorial(r1) + logFactorial(r2) + logFactorial(c1) + logFactorial(n - c1) -
    (logFactorial(x) + logFactorial(r1 - x) + logFactorial(c1 - x) + logFactorial(r2 - c1 + x) + logFactorial(n));
  const observed = logP(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const lp = logP(x);
    if (lp <= observed + 1e-7) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

export function detectableGap(n: number, alpha = 0.05): number {
  for (let other = n; other >= 0; other--) {
    if (fisherExactTwoSided(n, 0, other, n - other) < alpha) return (n - other) / n;
  }
  return 1;
}
