/**
 * Rótulos de produto para fluxos da plataforma (pedidos / vínculo).
 * Apenas strings e funções puras — sem efeitos colaterais.
 */

/** Nome no cadastro local ao criar cliente novo pela conversão governada (Bloco 2-D). */
export const NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST = 'Cliente da plataforma';

/** Cliente genérico em UI/pré-financeiro quando não há snapshot de nome (ADR snapshots). */
export const PLATFORM_CLIENT_DISPLAY_FALLBACK =
  NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST;

/** Fornecedor genérico quando não há snapshot de nome em pedidos/vínculos. */
export const PLATFORM_SUPPLIER_DISPLAY_FALLBACK = 'Fornecedor da plataforma';

/** Rótulo curto para conta com vínculo aprovado — uso pontual em UI (IDs ocultos). */
export const PLATFORM_LINKED_ACCOUNT_CAPTION = 'Conta vinculada';

/**
 * Nome sugerido para novo cliente local quando não há nome remoto confiável nesta versão.
 * @returns {string}
 */
export function deriveNewLocalClientNameFromLoanRequest() {
  return NEW_LOCAL_CLIENT_NAME_FROM_PLATFORM_LOAN_REQUEST;
}

/** Lista compacta no painel do fornecedor — substitui UID do cliente remoto. */
export const LOAN_REQUEST_SUPPLIER_ROW_CLIENT_CAPTION = 'Cliente vinculado na plataforma';

/** Detalhe expandido — substitui linkId técnico visível. */
export const LOAN_REQUEST_SUPPLIER_EXPANDED_LINK_CAPTION =
  'Pedido com vínculo aprovado entre contas na plataforma.';

/** Modal de revisão da conversão — participante do pedido. */
export const LOAN_REQUEST_MODAL_CLIENT_CAPTION = 'Cliente vinculado na plataforma';

/**
 * Linha única para `linkContext` completo (lista Clientes, contratos, filtros por rótulo).
 * Substitui máscaras tipo "Par: uid · uid".
 */
export const LOCAL_LINK_CONTEXT_FRIENDLY_LINE_COMPLETE = 'Vínculo com cliente na plataforma';
