'use client';

import { createContext, useContext } from 'react';

import { fontsReady, type MeasureInput, measureText } from '@/lib/canvas/text-measure';

/** Measures a label's border-box size; asynchronous because the first call waits for the fonts (EC-005). */
export type Measurer = (input: MeasureInput) => Promise<{ width: number; height: number }>;

/** Tests provide a stub measurer here; the default reads the DOM mirror after `fontsReady`. */
export const TextMeasureContext = createContext<Measurer | null>(null);

const defaultMeasurer: Measurer = async (input) => {
  await fontsReady();
  return measureText(input);
};

export function useTextMeasure(): Measurer {
  return useContext(TextMeasureContext) ?? defaultMeasurer;
}
