import { detectAutoPlan } from './auto-detect.js';
import { runCommandSuite } from './check-runner.js';

export async function runAutoCheck(root = process.cwd(), options = {}) {
  const plan = detectAutoPlan(root, options);
  if (!plan.languages.length) throw new Error('No supported source files or project manifests were detected.');
  if (!plan.commands.length) throw new Error(`Detected ${plan.languages.join(', ')}, but no safe automatic check could be selected.`);
  const run = await runCommandSuite({
    name: `auto-${plan.languages.join('-')}`,
    root: plan.root,
    commands: plan.commands
  }, {
    ...options,
    kind: 'auto-check',
    commandPrefix: 'auto',
    context: { ecosystem: plan.languages.join(' + '), runtime: `${plan.languages.join(' + ')} toolchain`, detectedLanguages: plan.languages, detectedManifests: plan.manifests }
  });
  return { plan, run };
}
