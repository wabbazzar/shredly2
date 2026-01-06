/**
 * Seeded Random Number Generator for Deterministic Testing
 *
 * Uses Mulberry32 algorithm for fast, deterministic pseudorandom numbers.
 * When a seed is provided, same seed = same random sequence.
 * When no seed is provided, uses Math.random() for true randomness.
 */

/**
 * Creates a seeded random number generator using Mulberry32 algorithm
 *
 * @param seed - Integer seed for deterministic randomness
 * @returns Function that returns random numbers in [0, 1)
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;

  return function(): number {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random number generator that can be either seeded (deterministic) or unseeded (random)
 */
export type RandomGenerator = () => number;

/**
 * Creates a random number generator based on optional seed
 *
 * @param seed - Optional seed for deterministic randomness. If undefined, uses Math.random()
 * @returns Random number generator function
 */
export function createRandom(seed?: number): RandomGenerator {
  if (seed !== undefined) {
    // Seeded - deterministic for testing
    return createSeededRandom(seed);
  } else {
    // Unseeded - true randomness for production
    return Math.random;
  }
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 *
 * @param array - Array to shuffle
 * @param random - Random number generator (seeded or unseeded)
 */
export function shuffleArray<T>(array: T[], random: RandomGenerator): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
