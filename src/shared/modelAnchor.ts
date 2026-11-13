/** Bounds use the caller's axis convention; upAxis identifies the vertical axis. */
export const bottomCenter = (minimum: readonly number[], maximum: readonly number[], upAxis: 1 | 2): [number, number, number] => [
  (minimum[0]! + maximum[0]!) / 2,
  upAxis === 1 ? minimum[1]! : (minimum[1]! + maximum[1]!) / 2,
  upAxis === 2 ? minimum[2]! : (minimum[2]! + maximum[2]!) / 2,
]
