/**
 * @sabd/correction — public surface. The CLI entry is src/cli.ts
 * (`pnpm --filter @sabd/correction propose|apply`).
 */
export { aggregateWords, calibrationEvents, NOISE_FLOOR, type WordStats } from './aggregate.ts';
export {
  applyCorrections,
  confidenceWeight,
  defaultCalibration,
  proposeCorrections,
  type CalibrationConfig,
  type CalibrationProposal,
  type WordNudge,
} from './calibrate.ts';
