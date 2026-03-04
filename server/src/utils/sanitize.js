function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

module.exports = { sanitizeString };
