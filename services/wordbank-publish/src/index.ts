/**
 * @sabd/wordbank-publish — public surface (the pure slicing core).
 * The CLI entry is src/publish.ts (`pnpm publish-slices`).
 */
export {
  cutSlices,
  serializeSlice,
  sha256Hex,
  sliceContentKey,
  sliceUrl,
  type CutResult,
  type CutSlice,
} from './slice.ts';
