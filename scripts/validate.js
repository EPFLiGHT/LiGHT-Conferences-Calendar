import fs from 'fs';
import yaml from 'js-yaml';
import { DateTime } from 'luxon';
import {
  REQUIRED_FIELDS,
  VALID_TYPES,
  VALID_DEADLINE_STATUS,
  YEAR_MIN,
  YEAR_MAX,
  isValidTimezone,
  isValidDateTime,
  isValidDate,
} from '../src/utils/conferenceSchema.js';
import { DATA_FILES } from '../src/constants/dataFiles.js';
import { SUBJECT_CODES as VALID_SUBJECTS } from '../src/constants/subjects.data.js';

const OPTIONAL_FIELDS = [
  'full_name', 'link', 'deadline', 'abstract_deadline',
  'place', 'date', 'start', 'end', 'paperslink', 'pwclink',
  'hindex', 'sub', 'note', 'deadline_status'
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

let errorCount = 0;
let warningCount = 0;

function error(message) {
  console.error(`❌ ERROR: ${message}`);
  errorCount++;
}

function warning(message) {
  console.warn(`⚠️  WARNING: ${message}`);
  warningCount++;
}

function success(message) {
  console.log(`✅ ${message}`);
}

function validateConference(conf, index) {
  const confId = conf.id || `conference at index ${index}`;

  // Check required fields
  REQUIRED_FIELDS.forEach(field => {
    if (!conf[field]) {
      error(`${confId}: Missing required field '${field}'`);
    }
  });

  // Check for unknown fields
  Object.keys(conf).forEach(field => {
    if (!ALL_FIELDS.includes(field)) {
      warning(`${confId}: Unknown field '${field}'`);
    }
  });

  // Validate timezone
  if (conf.timezone && !isValidTimezone(conf.timezone)) {
    error(`${confId}: Invalid IANA timezone '${conf.timezone}'`);
  }

  // Validate datetime fields (allow both HH:MM and HH:MM:SS)
  const dateTimeFields = ['deadline', 'abstract_deadline'];
  dateTimeFields.forEach(field => {
    if (conf[field] && !isValidDateTime(conf[field])) {
      error(`${confId}: Invalid datetime for '${field}': ${JSON.stringify(conf[field])} (use YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM)`);
    }
  });

  // Validate date-only fields
  const dateFields = ['start', 'end'];
  dateFields.forEach(field => {
    if (conf[field] && !isValidDate(conf[field])) {
      error(`${confId}: Invalid date for '${field}': ${JSON.stringify(conf[field])} (use YYYY-MM-DD)`);
    }
  });

  // Validate deadline_status
  if (conf.deadline_status && !VALID_DEADLINE_STATUS.includes(conf.deadline_status)) {
    error(`${confId}: Invalid deadline_status '${conf.deadline_status}' (use one of: ${VALID_DEADLINE_STATUS.join(', ')})`);
  }

  // Validate year
  if (conf.year) {
    if (typeof conf.year !== 'number') {
      error(`${confId}: Year must be a number, got ${typeof conf.year}`);
    } else if (conf.year < YEAR_MIN || conf.year > YEAR_MAX) {
      error(`${confId}: Year '${conf.year}' is out of reasonable range`);
    }
  }

  // Validate h-index
  if (conf.hindex !== undefined) {
    if (typeof conf.hindex !== 'number') {
      error(`${confId}: H-index must be a number, got ${typeof conf.hindex}. Current value: ${JSON.stringify(conf.hindex)}`);
    } else if (conf.hindex < 0) {
      error(`${confId}: H-index cannot be negative. Current value: ${conf.hindex}`);
    }
  }

  // Validate subject tag
  if (conf.sub) {
    // Handle both single subject (string) and multiple subjects (array)
    const subjects = Array.isArray(conf.sub) ? conf.sub : [conf.sub];
    subjects.forEach(subject => {
      if (!VALID_SUBJECTS.includes(subject)) {
        error(`${confId}: Invalid subject tag '${subject}'. Must be one of: ${VALID_SUBJECTS.join(', ')}`);
      }
    });
  }

  // Validate type
  if (conf.type && !VALID_TYPES.includes(conf.type)) {
    error(`${confId}: Invalid type '${conf.type}'. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  // Validate ID format (should be lowercase alphanumeric + last 2 digits of year)
  if (conf.id && conf.year) {
    const expectedSuffix = String(conf.year).slice(-2);
    if (!conf.id.endsWith(expectedSuffix)) {
      warning(`${confId}: ID should end with '${expectedSuffix}' (last 2 digits of year ${conf.year})`);
    }
    if (conf.id !== conf.id.toLowerCase()) {
      warning(`${confId}: ID should be lowercase`);
    }
  }

  // Validate URLs
  const urlFields = ['link', 'paperslink', 'pwclink'];
  urlFields.forEach(field => {
    if (conf[field] && typeof conf[field] === 'string') {
      try {
        new URL(conf[field].startsWith('http') ? conf[field] : `https://${conf[field]}`);
      } catch (e) {
        warning(`${confId}: Invalid URL for '${field}': ${conf[field]}`);
      }
    }
  });

  // Check date consistency
  if (conf.start && conf.end) {
    const start = DateTime.fromISO(conf.start);
    const end = DateTime.fromISO(conf.end);
    if (start.isValid && end.isValid && start > end) {
      error(`${confId}: Start date is after end date`);
    }
  }

  // Check deadline consistency
  if (conf.abstract_deadline && conf.deadline) {
    const abstract = DateTime.fromISO(conf.abstract_deadline);
    const submission = DateTime.fromISO(conf.deadline);
    if (abstract.isValid && submission.isValid && abstract > submission) {
      warning(`${confId}: Abstract deadline is after paper submission deadline`);
    }
  }
}

function validateFile(filePath, fileType) {
  console.log(`\n🔍 Validating ${filePath}...\n`);

  // Read and parse YAML with schema that preserves strings
  const yamlContent = fs.readFileSync(filePath, 'utf8');
  const conferences = yaml.load(yamlContent, { schema: yaml.JSON_SCHEMA });

  if (!Array.isArray(conferences)) {
    error(`${filePath}: YAML file must contain an array of conferences`);
    return [];
  }

  success(`Found ${conferences.length} ${fileType} to validate\n`);

  // Validate each conference
  conferences.forEach((conf, index) => {
    validateConference(conf, index);
  });

  // Check for duplicate IDs within this file
  const ids = conferences.map(c => c.id).filter(Boolean);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const uniqueDuplicates = [...new Set(duplicates)];

  if (uniqueDuplicates.length > 0) {
    uniqueDuplicates.forEach(id => {
      error(`${filePath}: Duplicate conference ID found: '${id}'`);
    });
  }

  return ids;
}

function main() {
  console.log('🔍 Validating conference data files...\n');

  try {
    const files = DATA_FILES.map(name => ({
      path: `public/data/${name}.yaml`,
      type: name,
    }));

    const allIds = [];

    // Validate each file
    files.forEach(({ path, type }) => {
      const ids = validateFile(path, type);
      allIds.push(...ids);
    });

    // Check for duplicate IDs across all files
    const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
    const uniqueDuplicates = [...new Set(duplicates)];

    if (uniqueDuplicates.length > 0) {
      uniqueDuplicates.forEach(id => {
        error(`Duplicate conference ID found across files: '${id}'`);
      });
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Validation Summary:');
    console.log('='.repeat(50));

    if (errorCount === 0 && warningCount === 0) {
      console.log('✅ All checks passed! The events data is valid.');
      process.exit(0);
    } else {
      if (errorCount > 0) {
        console.log(`❌ ${errorCount} error(s) found`);
      }
      if (warningCount > 0) {
        console.log(`⚠️  ${warningCount} warning(s) found`);
      }

      if (errorCount > 0) {
        console.log('\n❌ Validation failed. Please fix the errors above.');
        process.exit(1);
      } else {
        console.log('\n⚠️  Validation passed with warnings. Consider addressing them.');
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('❌ Fatal error during validation:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
