(function attachLovablePeopleCollector(root) {
  'use strict';

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function parseCreditNumber(value) {
    const text = normalizeText(value);
    const match = text.match(/-?\d[\d.,]*/);
    if (!match) return null;
    let token = match[0];
    if (token.startsWith('-')) return null;

    const comma = token.lastIndexOf(',');
    const dot = token.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      const decimalSeparator = comma > dot ? ',' : '.';
      const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
      token = token.split(thousandsSeparator).join('');
      token = token.replace(decimalSeparator, '.');
    } else {
      const separator = comma >= 0 ? ',' : (dot >= 0 ? '.' : null);
      if (separator) {
        const parts = token.split(separator);
        const looksLikeThousands = parts.length > 1
          && parts.slice(1).every((part) => part.length === 3)
          && parts[0].length >= 1
          && parts[0].length <= 3;
        token = looksLikeThousands ? parts.join('') : token.replace(separator, '.');
      }
    }

    const parsed = Number(token);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isPeopleSettingsUrl(value) {
    try {
      const url = new URL(String(value));
      return /\/projects\/[^/]+\/settings\/people\/?$/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }


  function shouldAutoRefreshPeoplePage(value, visibilityState) {
    return isPeopleSettingsUrl(value) && visibilityState === 'hidden';
  }

  function findColumns(headers) {
    const normalized = (headers || []).map((header) => normalizeText(header).toLowerCase());
    const usageIndex = normalized.findIndex((header) => header.includes('usage') && !header.includes('total'));
    const limitIndex = normalized.findIndex((header) => header.includes('credit') && header.includes('limit'));
    const nameIndex = normalized.findIndex((header) => header === 'name' || header.startsWith('name '));
    return {
      usageIndex,
      limitIndex,
      nameIndex: nameIndex >= 0 ? nameIndex : 0,
    };
  }

  function extractPeopleUsage(headers, rows) {
    const columns = findColumns(headers);
    if (columns.usageIndex < 0 || columns.limitIndex < 0) return null;

    const row = (rows || []).find((candidate) =>
      Array.isArray(candidate) && candidate.some((cell) => /\(you\)/i.test(normalizeText(cell))));
    if (!row) return null;

    const used = parseCreditNumber(row[columns.usageIndex]);
    const limit = parseCreditNumber(row[columns.limitIndex]);
    if (!Number.isFinite(used) || used < 0 || !Number.isFinite(limit) || limit <= 0) return null;

    return {
      used,
      limit,
      personLabel: normalizeText(row[columns.nameIndex] || row.find((cell) => /\(you\)/i.test(normalizeText(cell))) || '(you)'),
      usageHeader: normalizeText(headers[columns.usageIndex]),
    };
  }

  const api = {
    normalizeText,
    parseCreditNumber,
    isPeopleSettingsUrl,
    shouldAutoRefreshPeoplePage,
    findColumns,
    extractPeopleUsage,
  };

  root.LCMPeopleCollector = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
