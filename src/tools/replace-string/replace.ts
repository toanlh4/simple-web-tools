export type StepKind = 'text' | 'regex';

export interface ReplaceStep {
  id: string;
  enabled: boolean;
  kind: StepKind;
  find: string;
  replace: string;
  /** Regex flags, e.g. "gi". Ignored for plain-text steps. */
  flags: string;
}

/** A step without its runtime id, as stored in config files and browser storage. */
export type StepData = Omit<ReplaceStep, 'id'>;

export const REGEX_FLAGS: { flag: string; title: string }[] = [
  { flag: 'g', title: 'global: replace all matches' },
  { flag: 'i', title: 'ignore case' },
  { flag: 'm', title: 'multiline: ^ and $ match at line breaks' },
  { flag: 's', title: 'dotAll: . also matches line breaks' },
  { flag: 'u', title: 'unicode' },
  { flag: 'y', title: 'sticky: match only at lastIndex' },
];

export type StepResult =
  | { status: 'applied'; matches: number }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string };

let idCounter = 0;

export function newStepId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createStep(partial: Partial<StepData> = {}): ReplaceStep {
  return { enabled: true, kind: 'text', find: '', replace: '', flags: 'g', ...partial, id: newStepId() };
}

/** Builds the step's RegExp, or returns the error message when the pattern or flags are invalid. */
export function compileRegex(step: ReplaceStep): RegExp | string {
  try {
    return new RegExp(step.find, step.flags);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function countRegexMatches(input: string, re: RegExp): number {
  const global = re.flags.includes('g') ? re : new RegExp(re.source, `${re.flags}g`);
  let count = 0;
  for (const _ of input.matchAll(global)) {
    count += 1;
    if (!re.flags.includes('g')) break;
  }
  return count;
}

/** Applies the enabled steps in order. Returns the final text and one result per step (same order as `steps`). */
export function applySteps(input: string, steps: ReplaceStep[]): { output: string; results: StepResult[] } {
  let text = input;
  const results = steps.map((step): StepResult => {
    if (!step.enabled) return { status: 'skipped', reason: 'disabled' };
    if (step.find === '') return { status: 'skipped', reason: 'empty find' };

    if (step.kind === 'text') {
      const parts = text.split(step.find);
      text = parts.join(step.replace);
      return { status: 'applied', matches: parts.length - 1 };
    }

    const re = compileRegex(step);
    if (typeof re === 'string') return { status: 'error', message: re };
    const matches = countRegexMatches(text, re);
    text = text.replace(re, step.replace);
    return { status: 'applied', matches };
  });
  return { output: text, results };
}
