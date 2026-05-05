import { useEffect, useMemo, useState } from 'react';

import { loadSupplierDisplayNamesForIds } from '../utils/loadSupplierDisplayNamesForIds';

/**
 * Busca nomes amigáveis remotos (`users.displayName`) para UIDs de fornecedores.
 *
 * @param {string[]} supplierIds
 */
export function useSupplierDisplayNameMap(supplierIds) {
  const sortedKey = useMemo(() => {
    const u = [
      ...new Set(
        (supplierIds ?? []).filter((x) => typeof x === 'string' && x.trim().length > 0),
      ),
    ];
    u.sort();
    return u.join('|');
  }, [supplierIds]);

  const [supplierDisplayNames, setSupplierDisplayNames] = useState(
    /** @type {Record<string, string | undefined>} */ ({}),
  );
  const [supplierDisplayNamesLoading, setSupplierDisplayNamesLoading] =
    useState(false);

  useEffect(() => {
    if (!sortedKey) {
      setSupplierDisplayNames({});
      setSupplierDisplayNamesLoading(false);
      return;
    }

    const ids = sortedKey.split('|').filter(Boolean);
    let cancelled = false;

    setSupplierDisplayNamesLoading(true);
    void loadSupplierDisplayNamesForIds(ids)
      .then((m) => {
        if (!cancelled) setSupplierDisplayNames(m);
      })
      .finally(() => {
        if (!cancelled) setSupplierDisplayNamesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sortedKey]);

  return { supplierDisplayNames, supplierDisplayNamesLoading };
}
