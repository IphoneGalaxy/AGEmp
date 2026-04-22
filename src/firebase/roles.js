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
