// Function to validate ISO 8601 format
function isValidISO(isoString) {
  // Regular expression to match ISO 8601 format
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
  return isoRegex.test(isoString);
}

// Function to validate a date string in ISO 8601 format
function parseDate(dateString) {
  if (typeof dateString !== 'string') {
    throw new Error('Invalid input: Expected a date string');
  }
  if (!isValidISO(dateString)) {
    throw new Error('Invalid date string. Expected ISO 8601 format.');
  }
  return dateString;
}

module.exports = {
  parseDate,
  isValidISO
};