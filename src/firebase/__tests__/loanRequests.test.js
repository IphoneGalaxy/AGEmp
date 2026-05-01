import { describe, expect, it } from 'vitest';

import {
  LOAN_REQUEST_STATUSES,
  canActorTransitionLoanRequestV1,
  isLoanRequestOpenStatusV1,
  isLoanRequestTerminalStatusV1,
  isValidLoanRequestStatusV1,
} from '../loanRequests';
import { USER_ROLES } from '../roles';

describe('loanRequests v1 helpers', () => {
  it('valida statuses v1', () => {
    expect(isValidLoanRequestStatusV1(LOAN_REQUEST_STATUSES.PENDING)).toBe(true);
    expect(isValidLoanRequestStatusV1('counteroffer')).toBe(false);
  });

  it('classifica terminais e abertos', () => {
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.PENDING)).toBe(true);
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.UNDER_REVIEW)).toBe(true);
    expect(isLoanRequestOpenStatusV1(LOAN_REQUEST_STATUSES.APPROVED)).toBe(false);
    expect(isLoanRequestTerminalStatusV1(LOAN_REQUEST_STATUSES.APPROVED)).toBe(true);
  });

  it('permite transições do contrato v1', () => {
    expect(
      canActorTransitionLoanRequestV1(
        USER_ROLES.SUPPLIER,
        LOAN_REQUEST_STATUSES.PENDING,
        LOAN_REQUEST_STATUSES.UNDER_REVIEW,
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
  });
});
