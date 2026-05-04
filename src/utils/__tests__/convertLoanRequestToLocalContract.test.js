import { describe, it, expect, vi } from 'vitest';
import { LOAN_REQUEST_STATUSES } from '../../firebase/loanRequests';
import {
  applyApprovedLoanRequestConversion,
  attachLoanLinkContextFromConversion,
  clientMatchesLoanRequestForConversion,
  deriveLocalClientNameForApprovedLoanRequestConversion,
  findLoanRequestConversionCandidates,
  hasConvertedLoanRequestDuplicate,
  hasFullLoanRequestLinkTrio,
  parseInterestRateLikeManualAddLoan,
  principalAmountReaisFromApprovedRequest,
  todayIsoDateLocal,
} from '../convertLoanRequestToLocalContract';

vi.mock('../linkContext.js', () => ({
  LINK_CONTEXT_VERSION: 1,
  buildLocalLinkContext: (supplierId, clientId) => ({
    version: 1,
    linkId: `${supplierId}__${clientId}`,
    supplierId,
    clientId,
    associatedAt: '2026-05-04T12:00:00.000Z',
  }),
}));

const approvedRequest = (over = {}) => ({
  id: 'lr-fire-1',
  status: LOAN_REQUEST_STATUSES.APPROVED,
  supplierId: 'sup-a',
  clientId: 'cli-b',
  linkId: 'sup-a__cli-b',
  approvedAmount: 50_000,
  requestedAmount: 50_000,
  ...over,
});

describe('convertLoanRequestToLocalContract', () => {
  describe('deriveLocalClientNameForApprovedLoanRequestConversion', () => {
    it('usa clientDisplayNameSnapshot normalizado', () => {
      expect(
        deriveLocalClientNameForApprovedLoanRequestConversion({
          clientDisplayNameSnapshot: '  Mello  ',
        }),
      ).toBe('Mello');
    });
    it('fallback legado sem snapshot útil', () => {
      expect(deriveLocalClientNameForApprovedLoanRequestConversion({})).toBe('Cliente da plataforma');
      expect(
        deriveLocalClientNameForApprovedLoanRequestConversion({ clientDisplayNameSnapshot: '' }),
      ).toBe('Cliente da plataforma');
    });
  });

  describe('principalAmountReaisFromApprovedRequest', () => {
    it('centavos aprovados viram reais', () => {
      expect(principalAmountReaisFromApprovedRequest(approvedRequest({ approvedAmount: 12_345 }))).toBe(
        123.45,
      );
    });
    it('fallback requestedAmount quando approvedAmount inválido', () => {
      expect(
        principalAmountReaisFromApprovedRequest(
          approvedRequest({ approvedAmount: null, requestedAmount: 10_000 }),
        ),
      ).toBe(100);
    });
    it('status diferente de approved falha', () => {
      expect(
        principalAmountReaisFromApprovedRequest(
          approvedRequest({ status: LOAN_REQUEST_STATUSES.PENDING, approvedAmount: 10_000 }),
        ),
      ).toBeNull();
    });
  });

  describe('parseInterestRateLikeManualAddLoan', () => {
    it('aceita taxa válida', () => {
      expect(parseInterestRateLikeManualAddLoan(8.5)).toEqual({ ok: true, rate: 8.5 });
      expect(parseInterestRateLikeManualAddLoan(0)).toEqual({ ok: true, rate: 0 });
    });
    it('rejeita negativa ou não finita', () => {
      expect(parseInterestRateLikeManualAddLoan(-1).ok).toBe(false);
      expect(parseInterestRateLikeManualAddLoan(NaN).ok).toBe(false);
    });
  });

  describe('hasFullLoanRequestLinkTrio', () => {
    it('true quando trio completo', () => {
      expect(hasFullLoanRequestLinkTrio(approvedRequest())).toBe(true);
    });
    it('false quando falta campo', () => {
      expect(hasFullLoanRequestLinkTrio(approvedRequest({ linkId: '' }))).toBe(false);
    });
  });

  describe('attachLoanLinkContextFromConversion', () => {
    it('cria linkContext quando trio completo e ctx válido', () => {
      const req = approvedRequest();
      const lc = {
        version: 1,
        linkId: 'sup-a__cli-b',
        supplierId: 'sup-a',
        clientId: 'cli-b',
        associatedAt: 'x',
      };
      const loan = attachLoanLinkContextFromConversion(
        { id: 'L1', date: '2026-05-04', amount: 100, interestRate: 10, payments: [] },
        req,
        lc,
      );
      expect(loan.linkContext).toMatchObject({
        supplierId: 'sup-a',
        clientId: 'cli-b',
      });
    });
    it('não cria linkContext quando trio incompleto', () => {
      const req = approvedRequest({ linkId: '' });
      const loan = attachLoanLinkContextFromConversion(
        { id: 'L1', date: '2026-05-04', amount: 100, interestRate: 10, payments: [] },
        req,
        null,
      );
      expect(loan.linkContext).toBeUndefined();
    });
  });

  describe('hasConvertedLoanRequestDuplicate', () => {
    it('detecta convertedFromLoanRequestId repetido', () => {
      const clients = [
        {
          id: 'c1',
          loans: [{ id: 'x', convertedFromLoanRequestId: 'lr-fire-1', amount: 1, payments: [] }],
        },
      ];
      expect(hasConvertedLoanRequestDuplicate(clients, 'lr-fire-1')).toBe(true);
      expect(hasConvertedLoanRequestDuplicate(clients, 'other')).toBe(false);
    });
  });

  describe('findLoanRequestConversionCandidates', () => {
    const lc = {
      version: 1,
      linkId: 'sup-a__cli-b',
      supplierId: 'sup-a',
      clientId: 'cli-b',
      associatedAt: 'x',
    };
    it('reutiliza cliente existente único por linkId', () => {
      const clients = [{ id: 'c1', name: 'A', loans: [], linkContext: lc }];
      const found = findLoanRequestConversionCandidates(clients, approvedRequest());
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('c1');
    });
    it('match por supplierId/clientId', () => {
      const altLc = { ...lc, linkId: 'other' };
      const clients = [{ id: 'c2', loans: [], linkContext: altLc }];
      const found = findLoanRequestConversionCandidates(clients, approvedRequest());
      expect(found).toHaveLength(1);
    });
    it('bloqueia múltiplos candidatos', () => {
      const clients = [
        { id: 'c1', loans: [], linkContext: lc },
        { id: 'c2', loans: [], linkContext: { ...lc } },
      ];
      const res = applyApprovedLoanRequestConversion({
        clients,
        request: approvedRequest(),
        interestRate: 10,
        loanId: 'loan-new',
        newClientId: 'c-new',
        conversionDateIso: '2026-05-04',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message).toContain('Vários clientes');
    });
  });

  describe('applyApprovedLoanRequestConversion', () => {
    it('falha quando request sem id', () => {
      const res = applyApprovedLoanRequestConversion({
        clients: [],
        request: approvedRequest({ id: '' }),
        interestRate: 10,
        loanId: 'l1',
        newClientId: 'n1',
      });
      expect(res.ok).toBe(false);
    });

    it('cria cliente novo com nome do snapshot quando disponível', () => {
      const clients = [];
      const res = applyApprovedLoanRequestConversion({
        clients,
        request: approvedRequest({ clientDisplayNameSnapshot: 'Mello' }),
        interestRate: 10,
        loanId: 'loan-new',
        newClientId: 'c-new',
        conversionDateIso: '2026-05-04',
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.nextClients[0].name).toBe('Mello');
    });

    it('cria cliente novo quando não há candidato', () => {
      const clients = [];
      const res = applyApprovedLoanRequestConversion({
        clients,
        request: approvedRequest(),
        interestRate: 10,
        loanId: 'loan-new',
        newClientId: 'c-new',
        conversionDateIso: '2026-05-04',
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.nextClients).toHaveLength(1);
      expect(res.nextClients[0].id).toBe('c-new');
      expect(res.nextClients[0].name).toBe('Cliente da plataforma');
      expect(res.nextClients[0].loans).toHaveLength(1);
      expect(res.nextClients[0].loans[0].convertedFromLoanRequestId).toBe('lr-fire-1');
      expect(res.nextClients[0].loans[0].amount).toBe(500);
      expect(res.nextClients[0].linkContext).toBeDefined();
    });

    it('adiciona contrato ao cliente existente único', () => {
      const lc = {
        version: 1,
        linkId: 'sup-a__cli-b',
        supplierId: 'sup-a',
        clientId: 'cli-b',
        associatedAt: 'x',
      };
      const clients = [{ id: 'c-ex', name: 'Ex', loans: [], linkContext: lc }];
      const res = applyApprovedLoanRequestConversion({
        clients,
        request: approvedRequest(),
        interestRate: 12,
        loanId: 'loan-x',
        newClientId: 'unused',
        conversionDateIso: '2026-05-04',
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.nextClients).toHaveLength(1);
      expect(res.nextClients[0].loans).toHaveLength(1);
      expect(res.nextClients[0].loans[0].interestRate).toBe(12);
    });

    it('segunda conversão do mesmo pedido falha', () => {
      const lc = {
        version: 1,
        linkId: 'sup-a__cli-b',
        supplierId: 'sup-a',
        clientId: 'cli-b',
        associatedAt: 'x',
      };
      const clients = [
        {
          id: 'c1',
          loans: [
            {
              id: 'old',
              convertedFromLoanRequestId: 'lr-fire-1',
              amount: 1,
              payments: [],
            },
          ],
          linkContext: lc,
        },
      ];
      const res = applyApprovedLoanRequestConversion({
        clients,
        request: approvedRequest(),
        interestRate: 10,
        loanId: 'l2',
        newClientId: 'n2',
      });
      expect(res.ok).toBe(false);
    });

    it('não muta array/object clients original em caso de sucesso', () => {
      const lc = {
        version: 1,
        linkId: 'sup-a__cli-b',
        supplierId: 'sup-a',
        clientId: 'cli-b',
        associatedAt: 'x',
      };
      const inner = { id: 'c-ex', name: 'Ex', loans: [], linkContext: lc };
      const clients = [inner];
      const jsonBefore = JSON.stringify(clients);
      const res = applyApprovedLoanRequestConversion({
        clients,
        request: approvedRequest(),
        interestRate: 10,
        loanId: 'loan-x',
        newClientId: 'n-new',
      });
      expect(res.ok).toBe(true);
      expect(JSON.stringify(clients)).toBe(jsonBefore);
      expect(inner.loans).toHaveLength(0);
    });
  });

  describe('clientMatchesLoanRequestForConversion', () => {
    it('sem linkContext no cliente não casa', () => {
      expect(clientMatchesLoanRequestForConversion({ id: '1', loans: [] }, approvedRequest())).toBe(
        false,
      );
    });
  });

  describe('todayIsoDateLocal', () => {
    it('formata ISO local', () => {
      expect(todayIsoDateLocal(new Date(2026, 4, 4))).toBe('2026-05-04');
    });
  });
});
