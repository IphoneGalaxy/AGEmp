export const USER_ROLES = Object.freeze({
  SUPPLIER: 'supplier',
  CLIENT: 'client',
});

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

/**
 * @param {unknown} role
 * @returns {role is 'supplier' | 'client'}
 */
export function isValidUserRole(role) {
  return typeof role === 'string' && USER_ROLE_VALUES.includes(role);
}

/**
 * Valida o shape simples de `accountRoles` no perfil remoto.
 *
 * @param {unknown} value
 * @returns {value is Array<'supplier' | 'client'>}
 */
export function isValidAccountRolesArray(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    return false;
  }

  const seen = new Set();
  for (const item of value) {
    if (!isValidUserRole(item) || seen.has(item)) {
      return false;
    }
    seen.add(item);
  }

  return true;
}

/**
 * Ordena papéis de forma estável para UI e comparações simples.
 *
 * @param {Array<'supplier' | 'client'>} roles
 */
export function sortAccountRoles(roles) {
  const order = { [USER_ROLES.CLIENT]: 0, [USER_ROLES.SUPPLIER]: 1 };
  return [...roles].sort((a, b) => order[a] - order[b]);
}

/**
 * Fonte principal: `accountRoles` quando válido; fallback: `role` legado.
 *
 * @param {Record<string, unknown> | null | undefined} profile
 * @returns {Array<'supplier' | 'client'>}
 */
export function getEffectiveAccountRoles(profile) {
  if (!profile || typeof profile !== 'object') {
    return [];
  }

  const fromNew = profile.accountRoles;
  if (isValidAccountRolesArray(fromNew)) {
    return sortAccountRoles(fromNew);
  }

  const legacy = profile.role;
  if (isValidUserRole(legacy)) {
    return [legacy];
  }

  return [];
}

/**
 * @param {Record<string, unknown> | null | undefined} profile
 * @param {'supplier' | 'client'} role
 */
export function profileHasEffectiveAccountRole(profile, role) {
  return getEffectiveAccountRoles(profile).includes(role);
}

/**
 * @param {Record<string, unknown> | null | undefined} profile
 */
export function hasAnyEffectiveAccountRole(profile) {
  return getEffectiveAccountRoles(profile).length > 0;
}
