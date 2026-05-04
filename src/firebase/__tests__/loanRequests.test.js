import { describe, expect, it } from 'vitest';

import {
  LOAN_REQUEST_OPEN_STATUSES,
  LOAN_REQUEST_STATUSES,
  LOAN_REQUEST_TERMINAL_STATUSES,
  buildLoanRequestCreateSnapshotFields,
  canActorTransitionLoanRequestV1,
  canClientCancelLoanRequestV1,
  isLoanRequestOpenStatusV1,
  isLoanRequestSupplierNegotiationStatesV1,
  isLoanRequestTerminalStatusV1,
  isValidLoanRequestStatusV1,
} from '../loanRequests';
import { USER_ROLES } from '../roles';

describe('loanRequests v1 / v1.1 helpers', () => {
  it('valida statuses v1 (incluindo CN)', () => {
    expect(isValidLoanRequestStatusV1(LOAN_REQUEST_STATUSES.PENDING)).toBe(true);
    expect(isValidLoanRequestStatusV1(LOAN_REQUEST_STATUSES.COUNTEROFFER)).toBe(true);
    expect(isValidLoanRequestStatusV1(LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED)).toBe(true);
    expect(isValidLoanRequestStatusV1('foo')).toBe(false);
  });

  it('lista estados abertos para duplicidade inclui contraposta', () => {
    expect(LOAN_REQUEST_OPEN_STATUSES.includes(LOAN_REQUEST_STATUSES.COUNTEROFFER)).toBe(true);
  });

  it('classifica terminais e abertos', () => {
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.PENDING)).toBe(true);
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.UNDER_REVIEW)).toBe(true);
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.COUNTEROFFER)).toBe(true);
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.APPROVED)).toBe(false);
    expect(isLoanRequestTerminalStatusV1(LOAN_REQUEST_STATUSES.APPROVED)).toBe(true);
    expect(isLoanRequestTerminalStatusV1(LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED)).toBe(true);
    expect(
      LOAN_REQUEST_TERMINAL_STATUSES.includes(LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED),
    ).toBe(true);
  });

  it('cancelamento pelo cliente só em pendente / em análise', () => {
    expect(canClientCancelLoanRequestV1(LOAN_REQUEST_STATUSES.PENDING)).toBe(true);
    expect(canClientCancelLoanRequestV1(LOAN_REQUEST_STATUSES.COUNTEROFFER)).toBe(false);
  });

  it('ações de negociação direta do fornecedor só em pendente / em análise', () => {
    expect(isLoanRequestSupplierNegotiationStatesV1(LOAN_REQUEST_STATUSES.PENDING)).toBe(true);
    expect(isLoanRequestSupplierNegotiationStatesV1(LOAN_REQUEST_STATUSES.COUNTEROFFER)).toBe(false);
  });

  it('permite transições do contrato v1 + CN', () => {
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.SUPPLIER,
        LOAN_REQUEST_STATUSES.PENDING,
        LOAN_REQUEST_STATUSES.UNDER_REVIEW,
      ),
    ).toBe(true);
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.SUPPLIER,
        LOAN_REQUEST_STATUSES.PENDING,
        LOAN_REQUEST_STATUSES.COUNTEROFFER,
      ),
    ).toBe(true);
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.CLIENT,
        LOAN_REQUEST_STATUSES.COUNTEROFFER,
        LOAN_REQUEST_STATUSES.APPROVED,
      ),
    ).toBe(true);
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.CLIENT,
        LOAN_REQUEST_STATUSES.COUNTEROFFER,
        LOAN_REQUEST_STATUSES.COUNTEROFFER_DECLINED,
      ),
    ).toBe(true);
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.CLIENT,
        LOAN_REQUEST_STATUSES.UNDER_REVIEW,
        LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
      ),
    ).toBe(true);
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.SUPPLIER,
        LOAN_REQUEST_STATUSES.UNDER_REVIEW,
        LOAN_REQUEST_STATUSES.PENDING,
      ),
    ).toBe(false);
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.CLIENT,
        LOAN_REQUEST_STATUSES.PENDING,
        LOAN_REQUEST_STATUSES.CANCELLED_BY_CLIENT,
      ),
    ).toBe(true);
  });

  describe('buildLoanRequestCreateSnapshotFields', () => {
    it('prioriza snapshots do link quando presentes', () => {
      expect(
        buildLoanRequestCreateSnapshotFields(
          {
            clientDisplayNameSnapshot: 'Do link C',
            supplierDisplayNameSnapshot: 'Do link S',
          },
          { displayName: 'Perfil C' },
          { displayName: 'Perfil S' },
        ),
      ).toEqual({
        clientDisplayNameSnapshot: 'Do link C',
        supplierDisplayNameSnapshot: 'Do link S',
      });
    });

    it('usa perfil quando o link não tem snapshot útil', () => {
      expect(
        buildLoanRequestCreateSnapshotFields({}, { displayName: '  Ana  ' }, { displayName: 'Loja B' }),
      ).toEqual({
        clientDisplayNameSnapshot: 'Ana',
        supplierDisplayNameSnapshot: 'Loja B',
      });
    });

    it('mistura link e perfil quando só um lado existe no link', () => {
      expect(
        buildLoanRequestCreateSnapshotFields(
          { clientDisplayNameSnapshot: 'Só cliente no link' },
          { displayName: 'ignored' },
          { displayName: 'Fornecedor perfil' },
        ),
      ).toEqual({
        clientDisplayNameSnapshot: 'Só cliente no link',
        supplierDisplayNameSnapshot: 'Fornecedor perfil',
      });
    });

    it('devolve objeto vazio quando não há nomes úteis', () => {
      expect(
        buildLoanRequestCreateSnapshotFields(
          { clientDisplayNameSnapshot: '', supplierDisplayNameSnapshot: null },
          { displayName: '' },
          {},
        ),
      ).toEqual({});
    });
  });
});
