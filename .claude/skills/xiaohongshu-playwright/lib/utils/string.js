/**
 * 字符串处理工具
 */

function extractNoteId(value) {
  const text = String(value || "");
  const match = text.match(/\/([a-f0-9]{24})\b/i);
  return match ? match[1] : "";
}

function sanitizeKeywordForFilename(keyword) {
  return String(keyword || 'keyword').replace(/[\\:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '') || 'keyword';
}

function normalizeStringArray(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} 必须为数组`);
  }
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

module.exports = {
  extractNoteId,
  sanitizeKeywordForFilename,
  normalizeStringArray
};
