import { describe, expect, it } from 'vitest';

import {
  USER_ROLES,
  getEffectiveAccountRoles,
  hasAnyEffectiveAccountRole,
  isValidAccountRolesArray,
  profileHasEffectiveAccountRole,
  sortAccountRoles,
} from '../roles';

describe('firebase/roles (accountRoles)', () => {
  describe('isValidAccountRolesArray', () => {
    it('aceita um ou dois papéis distintos', () => {
      expect(isValidAccountRolesArray([USER_ROLES.CLIENT])).toBe(true);
      expect(isValidAccountRolesArray([USER_ROLES.SUPPLIER])).toBe(true);
      expect(
        isValidAccountRolesArray([USER_ROLES.CLIENT, USER_ROLES.SUPPLIER])
      ).toBe(true);
    });

    it('rejeita duplicatas, lista vazia ou papéis inválidos', () => {
      expect(isValidAccountRolesArray([])).toBe(false);
      expect(
        isValidAccountRolesArray([USER_ROLES.CLIENT, USER_ROLES.CLIENT])
      ).toBe(false);
      expect(isValidAccountRolesArray(['admin'])).toBe(false);
      expect(isValidAccountRolesArray(null)).toBe(false);
    });
  });

  describe('getEffectiveAccountRoles', () => {
    it('prioriza accountRoles válido sobre role legado', () => {
      expect(
        getEffectiveAccountRoles({
          role: USER_ROLES.CLIENT,
          accountRoles: [USER_ROLES.SUPPLIER],
        })
      ).toEqual([USER_ROLES.SUPPLIER]);
    });

    it('usa role legado quando accountRoles está ausente ou inválido', () => {
      expect(
        getEffectiveAccountRoles({ role: USER_ROLES.SUPPLIER })
      ).toEqual([USER_ROLES.SUPPLIER]);
      expect(
        getEffectiveAccountRoles({
          role: USER_ROLES.SUPPLIER,
          accountRoles: [],
        })
      ).toEqual([USER_ROLES.SUPPLIER]);
    });

    it('ordena de forma estável', () => {
      expect(
        sortAccountRoles([USER_ROLES.SUPPLIER, USER_ROLES.CLIENT])
      ).toEqual([USER_ROLES.CLIENT, USER_ROLES.SUPPLIER]);
    });
  });

  describe('profileHasEffectiveAccountRole', () => {
    it('reflete o conjunto efetivo', () => {
      expect(
        profileHasEffectiveAccountRole(
          { accountRoles: [USER_ROLES.CLIENT, USER_ROLES.SUPPLIER] },
          USER_ROLES.CLIENT
        )
      ).toBe(true);
      expect(
        profileHasEffectiveAccountRole({ role: USER_ROLES.CLIENT }, USER_ROLES.SUPPLIER)
      ).toBe(false);
    });
  });

  describe('hasAnyEffectiveAccountRole', () => {
    it('é falso sem papéis reconhecidos', () => {
      expect(hasAnyEffectiveAccountRole({})).toBe(false);
      expect(hasAnyEffectiveAccountRole({ role: 'x' })).toBe(false);
    });

    it('é verdadeiro com legado ou accountRoles', () => {
      expect(hasAnyEffectiveAccountRole({ role: USER_ROLES.CLIENT })).toBe(true);
      expect(
        hasAnyEffectiveAccountRole({ accountRoles: [USER_ROLES.SUPPLIER] })
      ).toBe(true);
    });
  });
});
