/**
 * YAML load/serialize for the conference data files. Exists to protect one
 * contract: src/utils/parser.ts loads the YAML with js-yaml's DEFAULT schema,
 * where an unquoted `2026-10-06` becomes a Date object, so date-like strings
 * must stay quoted when this module writes the file back.
 */
import fs from 'fs';
import { load, dump, JSON_SCHEMA } from 'js-yaml';

/**
 * Load a data file as plain objects (JSON schema: every scalar stays a string,
 * matching scripts/validate.js).
 * @param {string} filePath Path to the YAML file.
 * @returns {object[]} The entries.
 */
export function loadEntries(filePath) {
  return load(fs.readFileSync(filePath, 'utf8'), { schema: JSON_SCHEMA });
}

/**
 * Serialize entries back to YAML, one blank line between entries.
 * @param {object[]} entries The entries to dump.
 * @returns {string} YAML text; date-like strings come out quoted (see header).
 */
export function serializeEntries(entries) {
  // Dump entry by entry so the file keeps a blank line between entries.
  // Default dump schema quotes scalars that would re-parse as timestamps.
  return entries
    .map((entry) => dump([entry], { lineWidth: -1, noRefs: true }))
    .join('\n');
}

/**
 * Serialize entries and write them to disk.
 * @param {string} filePath Path to the YAML file.
 * @param {object[]} entries The entries to write.
 * @returns {void}
 */
export function saveEntries(filePath, entries) {
  fs.writeFileSync(filePath, serializeEntries(entries));
}
