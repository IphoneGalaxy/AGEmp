import { LOAN_REQUEST_STATUSES } from '../firebase/loanRequests';
import { approvedAmountCentsToReaisOrNull } from './convertLoanRequestReviewDerive';
import { buildLocalLinkContext } from './linkContext';
import { deriveNewLocalClientNameFromLoanRequest } from './platformFriendlyLabels';
import { buildLoanWithOptionalLinkContext, canInheritLinkContextToLoan } from './loanLinkContextInherit';
import { buildNewClientWithOptionalLinkContext } from './newClientLinkInherit';

/** @returns {string} YYYY-MM-DD no fuso local */
export function todayIsoDateLocal(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Valor em reais para pedido `approved`: prioriza approvedAmount (centavos); fallback requestedAmount.
 *
 * @param {Record<string, unknown>} request
 * @returns {number | null}
 */
export function principalAmountReaisFromApprovedRequest(request) {
  if (!request || request.status !== LOAN_REQUEST_STATUSES.APPROVED) return null;
  let r = approvedAmountCentsToReaisOrNull(request.approvedAmount);
  if (r != null && r > 0 && Number.isFinite(r)) return r;
  r = approvedAmountCentsToReaisOrNull(request.requestedAmount);
  if (r != null && r > 0 && Number.isFinite(r)) return r;
  return null;
}

/**
 * Mesma regra base que novo contrato manual em ClientView: número finito e ≥ 0.
 *
 * @param {unknown} interestRate
 * @returns {{ ok: true, rate: number } | { ok: false }}
 */
export function parseInterestRateLikeManualAddLoan(interestRate) {
  const rate = Number(interestRate);
  if (!Number.isFinite(rate) || rate < 0) return { ok: false };
  return { ok: true, rate };
}

/**
 * @param {Record<string, unknown>} request
 */
export function hasFullLoanRequestLinkTrio(request) {
  if (!request || typeof request !== 'object') return false;
  return (
    typeof request.linkId === 'string' &&
    request.linkId.length > 0 &&
    typeof request.supplierId === 'string' &&
    request.supplierId.length > 0 &&
    typeof request.clientId === 'string' &&
    request.clientId.length > 0
  );
}

/**
 * @param {unknown} client
 * @param {Record<string, unknown>} request
 */
export function clientMatchesLoanRequestForConversion(client, request) {
  const lc = client?.linkContext;
  if (!lc || typeof lc !== 'object') return false;
  const linkOk =
    typeof request.linkId === 'string' &&
    request.linkId.length > 0 &&
    lc.linkId === request.linkId;
  const pairOk =
    typeof request.supplierId === 'string' &&
    request.supplierId.length > 0 &&
    typeof request.clientId === 'string' &&
    request.clientId.length > 0 &&
    lc.supplierId === request.supplierId &&
    lc.clientId === request.clientId;
  return !!(linkOk || pairOk);
}

/**
 * @param {unknown[]} clients
 * @param {Record<string, unknown>} request
 * @returns {unknown[]}
 */
export function findLoanRequestConversionCandidates(clients, request) {
  if (!Array.isArray(clients) || !request) return [];
  return clients.filter((c) => clientMatchesLoanRequestForConversion(c, request));
}

/**
 * Anti-duplicidade mínima obrigatória (Bloco 2).
 *
 * @param {unknown[]} clients
 * @param {string} loanRequestId id Firestore do pedido
 */
export function hasConvertedLoanRequestDuplicate(clients, loanRequestId) {
  if (!Array.isArray(clients) || typeof loanRequestId !== 'string' || !loanRequestId) return false;
  for (const c of clients) {
    const loans = Array.isArray(c?.loans) ? c.loans : [];
    for (const loan of loans) {
      if (loan?.convertedFromLoanRequestId === loanRequestId) return true;
    }
  }
  return false;
}

/**
 * Monta `loan.linkContext` via util existente (snapshot v1) quando o trio remoto está completo.
 *
 * @param {Record<string, unknown>} loanBase
 * @param {Record<string, unknown>} request
 * @param {Record<string, unknown> | null | undefined} clientLinkContextForInherit
 */
export function attachLoanLinkContextFromConversion(loanBase, request, clientLinkContextForInherit) {
  const trio = hasFullLoanRequestLinkTrio(request);
  if (!trio) return { ...loanBase };
  const ctx =
    clientLinkContextForInherit && canInheritLinkContextToLoan(clientLinkContextForInherit)
      ? clientLinkContextForInherit
      : typeof request.supplierId === 'string' && typeof request.clientId === 'string'
        ? buildLocalLinkContext(request.supplierId, request.clientId)
        : null;
  return buildLoanWithOptionalLinkContext({
    loan: loanBase,
    clientLinkContext: ctx,
    includeLinkContext: ctx != null && canInheritLinkContextToLoan(ctx),
  });
}

/**
 * Conversão governada: anti-duplicidade, cliente único ou novo, contrato local imutável.
 *
 * @param {Object} p
 * @param {unknown[]} p.clients cópia não é necessária — não muta `p.clients`.
 * @param {Record<string, unknown>} p.request
 * @param {number} p.interestRate taxa % (validação alinhada ao manual)
 * @param {string} p.loanId id local do novo contrato (`generateId`)
 * @param {string} p.newClientId id local se precisar criar cliente (`generateId`)
 * @param {string} [p.conversionDateIso] YYYY-MM-DD (D6); default hoje local
 * @returns {{ ok: true, nextClients: unknown[] } | { ok: false, message: string }}
 */
export function applyApprovedLoanRequestConversion({
  clients,
  request,
  interestRate,
  loanId,
  newClientId,
  conversionDateIso,
}) {
  if (!Array.isArray(clients)) {
    return { ok: false, message: 'Dados locais indisponíveis para registrar o contrato.' };
  }
  if (!request || typeof request !== 'object') {
    return { ok: false, message: 'Pedido inválido.' };
  }
  if (request.status !== LOAN_REQUEST_STATUSES.APPROVED) {
    return { ok: false, message: 'Só é possível registrar contrato a partir de pedido aprovado na plataforma.' };
  }
  if (typeof request.id !== 'string' || !request.id.trim()) {
    return { ok: false, message: 'Pedido sem identificador — não é possível registrar.' };
  }

  const parsedRate = parseInterestRateLikeManualAddLoan(interestRate);
  if (!parsedRate.ok) {
    return { ok: false, message: 'Taxa de juros inválida.' };
  }

  const principal = principalAmountReaisFromApprovedRequest(request);
  if (principal == null || principal <= 0) {
    return { ok: false, message: 'Valor aprovado inválido para registro neste aparelho.' };
  }

  const reqId = request.id.trim();
  if (hasConvertedLoanRequestDuplicate(clients, reqId)) {
    return {
      ok: false,
      message: 'Este pedido já foi registrado como contrato local neste aparelho.',
    };
  }

  if (typeof loanId !== 'string' || !loanId || typeof newClientId !== 'string' || !newClientId) {
    return { ok: false, message: 'Erro interno ao gerar identificadores locais.' };
  }

  const dateIso =
    typeof conversionDateIso === 'string' && conversionDateIso.trim()
      ? conversionDateIso.trim()
      : todayIsoDateLocal();

  const candidates = findLoanRequestConversionCandidates(clients, request);
  if (candidates.length > 1) {
    return {
      ok: false,
      message:
        'Vários clientes locais correspondem a este vínculo. Escolha ou una cadastros manualmente antes de registrar — seleção automática não está disponível.',
    };
  }

  const loanBase = {
    id: loanId,
    date: dateIso,
    amount: principal,
    interestRate: parsedRate.rate,
    payments: [],
    convertedFromLoanRequestId: reqId,
  };

  if (candidates.length === 1) {
    const target = candidates[0];
    const ctxForLoan =
      target.linkContext && canInheritLinkContextToLoan(target.linkContext)
        ? target.linkContext
        : hasFullLoanRequestLinkTrio(request)
          ? buildLocalLinkContext(request.supplierId, request.clientId)
          : null;

    const loan = attachLoanLinkContextFromConversion(loanBase, request, ctxForLoan);

    const nextClients = clients.map((c) => {
      if (c.id !== target.id) return c;
      const prevLoans = Array.isArray(c.loans) ? c.loans : [];
      return { ...c, loans: [loan, ...prevLoans] };
    });
    return { ok: true, nextClients };
  }

  const template =
    typeof request.supplierId === 'string' &&
    request.supplierId &&
    typeof request.clientId === 'string' &&
    request.clientId
      ? { supplierId: request.supplierId, clientId: request.clientId }
      : null;

  const newClient = buildNewClientWithOptionalLinkContext({
    id: newClientId,
    name: deriveNewLocalClientNameFromLoanRequest(),
    loans: [],
    includeLinkContext: !!template,
    templateLinkContext: template,
  });

  const ctxForLoan =
    newClient.linkContext && canInheritLinkContextToLoan(newClient.linkContext)
      ? newClient.linkContext
      : template
        ? buildLocalLinkContext(template.supplierId, template.clientId)
        : null;

  const loan = attachLoanLinkContextFromConversion(loanBase, request, ctxForLoan);

  const clientWithLoan = { ...newClient, loans: [loan] };
  const nextClients = [clientWithLoan, ...clients];
  return { ok: true, nextClients };
}
