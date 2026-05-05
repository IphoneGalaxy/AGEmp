/**
 * Arquivamento local do cliente (`archivedAt` no objeto cliente).
 */

/**
 * @param {unknown} client
 * @returns {boolean}
 */
export function isClientArchived(client) {
  const v = client?.archivedAt;
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * @returns {string} ISO UTC
 */
export function archiveClientNowIso() {
  return new Date().toISOString();
}
