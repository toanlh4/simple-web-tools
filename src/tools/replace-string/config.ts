import { createStep, type ReplaceStep, type StepData, type StepKind } from './replace';

const CONFIG_TOOL = 'replace-string';
const CONFIG_VERSION = 1;

export interface ReplaceConfig {
  tool: typeof CONFIG_TOOL;
  version: number;
  steps: StepData[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStepKind(value: unknown): value is StepKind {
  return value === 'text' || value === 'regex';
}

/** Strips runtime ids so steps can be stored. */
export function toStepData(steps: ReplaceStep[]): StepData[] {
  return steps.map(({ enabled, kind, find, replace, flags }) => ({ enabled, kind, find, replace, flags }));
}

export function serializeConfig(steps: ReplaceStep[]): string {
  const config: ReplaceConfig = { tool: CONFIG_TOOL, version: CONFIG_VERSION, steps: toStepData(steps) };
  return JSON.stringify(config, null, 2);
}

/** Validates raw step objects and gives each a fresh id. Throws an Error with a readable message on invalid input. */
export function parseSteps(rawSteps: unknown[]): ReplaceStep[] {
  return rawSteps.map((raw, i) => {
    if (!isRecord(raw)) throw new Error(`Step ${i + 1} is not an object.`);
    const { enabled, kind, find, replace, flags } = raw;
    if (!isStepKind(kind)) throw new Error(`Step ${i + 1}: "kind" must be "text" or "regex".`);
    if (typeof find !== 'string' || typeof replace !== 'string') {
      throw new Error(`Step ${i + 1}: "find" and "replace" must be strings.`);
    }
    return createStep({
      enabled: typeof enabled === 'boolean' ? enabled : true,
      kind,
      find,
      replace,
      flags: typeof flags === 'string' ? flags : 'g',
    });
  });
}

/** Parses an exported config file. Throws an Error with a readable message when the file is not a valid config. */
export function parseConfig(json: string): ReplaceStep[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!isRecord(data) || !Array.isArray(data.steps)) {
    throw new Error('File is not a Replace String config (missing "steps" array).');
  }
  if (data.tool !== undefined && data.tool !== CONFIG_TOOL) {
    throw new Error(`Config is for tool "${String(data.tool)}", not "${CONFIG_TOOL}".`);
  }
  return parseSteps(data.steps);
}

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
