import { describe, it, expect } from 'vitest';
import {
  deriveNewLocalClientNameFromLoanRequest,
  NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST,
} from '../platformFriendlyLabels';

describe('platformFriendlyLabels', () => {
  it('deriveNewLocalClientNameFromLoanRequest devolve rótulo amigável estável', () => {
    expect(deriveNewLocalClientNameFromLoanRequest()).toBe(
      NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST,
    );
  });
});
