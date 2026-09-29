import path from 'path';
import { fileURLToPath } from 'url';
import { validateEntry, findDuplicateIds } from '../src/utils/conferenceSchema.js';
import { DATA_FILES } from '../src/constants/dataFiles.js';
import { loadEntries } from './sync-shared/yamlio.js';

function report(issues) {
  for (const { level, message } of issues) {
    if (level === 'error') console.error(`❌ ERROR: ${message}`);
    else console.warn(`⚠️  WARNING: ${message}`);
  }
}

function validateFile(filePath) {
  const entries = loadEntries(filePath);
  if (!Array.isArray(entries)) {
    return { ids: [], issues: [{ level: 'error', message: `${filePath}: YAML file must contain an array of conferences` }] };
  }
  const issues = entries.flatMap((conf, index) => validateEntry(conf, index));
  const ids = entries.map((c) => c.id).filter(Boolean);
  for (const id of findDuplicateIds(ids)) {
    issues.push({ level: 'error', message: `${filePath}: Duplicate conference ID found: '${id}'` });
  }
  console.log(`✅ Found ${entries.length} entries`);
  return { ids: [...new Set(ids)], issues };
}

function main() {
  const issues = [];
  const allIds = [];
  for (const name of DATA_FILES) {
    const filePath = `public/data/${name}.yaml`;
    console.log(`\n🔍 Validating ${filePath}...`);
    const result = validateFile(filePath);
    report(result.issues);
    issues.push(...result.issues);
    allIds.push(...result.ids);
  }
  const crossFile = findDuplicateIds(allIds).map((id) => ({
    level: 'error',
    message: `Duplicate conference ID found across files: '${id}'`,
  }));
  report(crossFile);
  issues.push(...crossFile);

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  console.log(`\n${'='.repeat(50)}\nValidation Summary:\n${'='.repeat(50)}`);
  if (issues.length === 0) {
    console.log('✅ All checks passed! The events data is valid.');
    return 0;
  }
  if (errors.length > 0) console.log(`❌ ${errors.length} error(s) found`);
  if (warnings.length > 0) console.log(`⚠️  ${warnings.length} warning(s) found`);
  if (errors.length > 0) {
    console.log('\n❌ Validation failed. Please fix the errors above.');
    return 1;
  }
  console.log('\n⚠️  Validation passed with warnings. Consider addressing them.');
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error('❌ Fatal error during validation:');
    console.error(err.message);
    process.exitCode = 1;
  }
}
