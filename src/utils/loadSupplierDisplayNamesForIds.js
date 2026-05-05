import { getUserProfile } from '../firebase/users';

/**
 * Carrega `displayName` remoto dos perfis para uma lista de UIDs (leitura permitida pelo modelo atual).
 * Falhas isoladas não abortam o lote — retorna entrada omitida ou `undefined` no valor.
 *
 * @param {string[]} uids
 * @returns {Promise<Record<string, string | undefined>>}
 */
export async function loadSupplierDisplayNamesForIds(uids) {
  const unique = [
    ...new Set(
      (uids ?? []).filter((u) => typeof u === 'string' && u.trim().length > 0),
    ),
  ];
  if (unique.length === 0) {
    return {};
  }

  const pairs = await Promise.all(
    unique.map(async (uid) => {
      try {
        const data = await getUserProfile(uid);
        const raw = data?.displayName;
        const dn =
          raw != null && String(raw).trim().length > 0 ? String(raw).trim() : '';
        return /** @type {const} */ ([uid, dn || undefined]);
      } catch {
        return /** @type {const} */ ([uid, undefined]);
      }
    }),
  );

  return Object.fromEntries(pairs);
}
