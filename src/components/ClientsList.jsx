import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { generateId } from '../utils/ids';
import {
  filterClientsByLinkContextPresence,
  LINK_LIST_FILTER,
} from '../utils/clientLinkListFilter';
import {
  filterClientsByLocalLinkId,
  formatLocalVinculoLineFromContext,
} from '../utils/localLinkContextOrganize';
import {
  listOperationalLinkOptions,
  findOperationalLinkOption,
} from '../utils/linkOperationalDerive';
import {
  getLinkContextTemplateForInheritFromClients,
  buildNewClientWithOptionalLinkContext,
} from '../utils/newClientLinkInherit';
import {
  isBatchLinkAnnotateEligible,
  isTemplateConsistentWithLinkId,
  applyLinkContextToClientsBatch,
  removeLinkContextFromClientsBatch,
} from '../utils/clientLinkContextBatch';

/**
 * Componente Lista de Clientes.
 *
 * Exibe:
 * - Formulário para adicionar novo cliente
 * - Filtro local opcional por presença de anotação de vínculo (linkContext)
 * - Refino opcional por vínculo específico (`linkId`), com contagens operacionais derivadas (cadastros/contratos/registros pag. em contratos anotados)
 * - Opcional: ao criar cliente com filtro de vínculo ativo, herdar anotação local (reversível antes de salvar)
 * - Modo de seleção em lote: anotar com o vínculo ativo do refinamento ou remover anotação (local, sem nuvem)
 * - Lista de clientes com status de pagamento e dívida total
 * - Badges de status (OK, Falta, Sem dívidas)
 *
 * @param {Object} props
 * @param {Array}    props.clients - Clientes brutos (estado; mesmos ids que processedClients).
 * @param {Array}    props.processedClients - Clientes com dados processados.
 * @param {Function} props.onAddClient - Callback para adicionar novo cliente.
 * @param {Function} props.onUpdateClients - Callback (updater) => void para atualizar o array de clientes.
 * @param {Function} props.onSelectClient - Callback para selecionar/abrir um cliente.
 * @param {Function} props.showToast - Callback para exibir notificação toast.
 * @param {Function} props.displayMoney - Função para formatar/ocultar valores monetários.
 */
const ClientsList = ({
  clients = [],
  processedClients = [],
  onAddClient,
  onUpdateClients,
  onSelectClient,
  showToast,
  displayMoney,
}) => {
  const clientsCount = clients.length;

  const [newClientName, setNewClientName] = useState('');
  const [inheritVinculoOnCreate, setInheritVinculoOnCreate] = useState(true);
  const [linkFilter, setLinkFilter] = useState(LINK_LIST_FILTER.ALL);
  const [localLinkIdFilter, setLocalLinkIdFilter] = useState('');

  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedIdList, setSelectedIdList] = useState([]);

  const selectedSet = useMemo(() => new Set(selectedIdList), [selectedIdList]);

  const linkedCount = useMemo(
    () => processedClients.filter((c) => c?.linkContext).length,
    [processedClients]
  );
  const unlinkedCount = useMemo(
    () => Math.max(0, processedClients.length - linkedCount),
    [processedClients, linkedCount]
  );

  const operationalLinks = useMemo(
    () => listOperationalLinkOptions(processedClients),
    [processedClients]
  );

  const operationalSnapshot = useMemo(
    () => findOperationalLinkOption(operationalLinks, localLinkIdFilter),
    [operationalLinks, localLinkIdFilter]
  );

  const baseFiltered = useMemo(
    () => filterClientsByLinkContextPresence(processedClients, linkFilter),
    [processedClients, linkFilter]
  );

  const visibleClients = useMemo(
    () => filterClientsByLocalLinkId(baseFiltered, localLinkIdFilter),
    [baseFiltered, localLinkIdFilter]
  );

  const inheritTemplate = useMemo(
    () =>
      getLinkContextTemplateForInheritFromClients(
        processedClients,
        linkFilter,
        localLinkIdFilter
      ),
    [processedClients, linkFilter, localLinkIdFilter]
  );
  const showVinculoInheritOption = Boolean(inheritTemplate);

  const batchAnnotateTemplateOk = useMemo(
    () =>
      Boolean(
        inheritTemplate &&
          isTemplateConsistentWithLinkId(
            inheritTemplate.supplierId,
            inheritTemplate.clientId,
            localLinkIdFilter
          )
      ),
    [inheritTemplate, localLinkIdFilter]
  );

  const canShowBatchAnnotate = useMemo(
    () =>
      batchSelectMode &&
      isBatchLinkAnnotateEligible(linkFilter, localLinkIdFilter) &&
      batchAnnotateTemplateOk,
    [batchSelectMode, linkFilter, localLinkIdFilter, batchAnnotateTemplateOk]
  );

  useEffect(() => {
    if (linkFilter === LINK_LIST_FILTER.UNLINKED) {
      setLocalLinkIdFilter('');
    }
  }, [linkFilter]);

  useEffect(() => {
    if (linkFilter === LINK_LIST_FILTER.UNLINKED) return;
    if (localLinkIdFilter) {
      setInheritVinculoOnCreate(true);
    }
  }, [linkFilter, localLinkIdFilter]);

  useEffect(() => {
    setSelectedIdList([]);
  }, [linkFilter, localLinkIdFilter]);

  const clearAllFilters = () => {
    setLinkFilter(LINK_LIST_FILTER.ALL);
    setLocalLinkIdFilter('');
  };

  const toggleClientSelected = useCallback((id) => {
    if (!id) return;
    setSelectedIdList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIdList(visibleClients.map((c) => c.id).filter(Boolean));
  }, [visibleClients]);

  const clearSelection = useCallback(() => {
    setSelectedIdList([]);
  }, []);

  const exitBatchMode = useCallback(() => {
    setBatchSelectMode(false);
    setSelectedIdList([]);
  }, []);

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    const include = showVinculoInheritOption && inheritVinculoOnCreate;
    const newClient = buildNewClientWithOptionalLinkContext({
      id: generateId(),
      name: newClientName.trim(),
      loans: [],
      includeLinkContext: include,
      templateLinkContext: inheritTemplate,
    });
    onAddClient(newClient);
    setNewClientName('');
    showToast(
      include
        ? '👤 Cliente criado (anotação de vínculo local incluída).'
        : '👤 Cliente criado!'
    );
  };

  const handleBatchAnnotate = useCallback(() => {
    if (!onUpdateClients || !canShowBatchAnnotate || !inheritTemplate) {
      showToast('❌ Ajuste o filtro: escolha um vínculo no refinamento para anotar em lote.');
      return;
    }
    if (selectedIdList.length === 0) {
      showToast('Selecione ao menos um cliente para anotar.');
      return;
    }
    const { nextClients, applied, alreadySame, skippedOther } = applyLinkContextToClientsBatch({
      allClients: clients,
      selectedIds: selectedIdList,
      targetSupplierId: inheritTemplate.supplierId,
      targetClientId: inheritTemplate.clientId,
    });
    onUpdateClients(() => nextClients);
    const parts = [];
    if (applied > 0) parts.push(`anotados: ${applied}`);
    if (alreadySame > 0) parts.push(`já com este vínculo: ${alreadySame}`);
    if (skippedOther > 0) parts.push(`outro vínculo (não alterado): ${skippedOther}`);
    showToast(
      parts.length
        ? `Anotação local: ${parts.join(' · ')}. Não envia financeiro.`
        : 'Nada a alterar: todos selecionados já tinham este vínculo ou outro anotado.'
    );
    setSelectedIdList([]);
  }, [onUpdateClients, canShowBatchAnnotate, inheritTemplate, selectedIdList, clients, showToast]);

  const handleBatchRemove = useCallback(() => {
    if (!onUpdateClients) return;
    if (selectedIdList.length === 0) {
      showToast('Selecione ao menos um cliente para remover a anotação.');
      return;
    }
    const { nextClients, removed, hadNone } = removeLinkContextFromClientsBatch({
      allClients: clients,
      selectedIds: selectedIdList,
    });
    onUpdateClients(() => nextClients);
    const parts = [];
    if (removed > 0) parts.push(`anotação removida: ${removed}`);
    if (hadNone > 0) parts.push(`sem anotação: ${hadNone}`);
    showToast(
      parts.length
        ? `Remoção local (só anotação): ${parts.join(' · ')}.`
        : 'Nada a remover na seleção.'
    );
    setSelectedIdList([]);
  }, [onUpdateClients, selectedIdList, clients, showToast]);

  const filterButtonClass = (active) =>
    `inline-flex min-h-[40px] flex-1 items-center justify-center rounded-design-md px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:text-sm ${
      active
        ? 'bg-surface text-info shadow-design-sm ring-1 ring-inset ring-info/35'
        : 'bg-transparent text-content-muted hover:bg-surface/80'
    }`;

  const emptyStateMessage = () => {
    if (linkFilter === LINK_LIST_FILTER.LINKED && linkedCount === 0) {
      return 'Nenhum cliente com anotação de vínculo neste escopo local de dados.';
    }
    if (localLinkIdFilter) {
      return 'Nenhum cliente anotado para este vínculo neste escopo local de dados.';
    }
    return 'Nenhum cliente corresponde a este filtro neste escopo local de dados.';
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      <form
        onSubmit={handleAddClient}
        className="mb-6 flex flex-col gap-3 rounded-design-lg border border-edge bg-surface p-4 shadow-design-sm"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
          <input
            type="text"
            required
            className="min-h-[44px] w-full flex-1 rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-content placeholder:text-content-muted shadow-none sm:min-w-0"
            placeholder="Nome do novo cliente"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-design-md bg-primary px-5 font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover sm:w-auto"
          >
            Criar
          </button>
        </div>
        {showVinculoInheritOption && (
          <label
            htmlFor="client-inherit-vinculo"
            className="flex cursor-pointer items-start gap-3 rounded-design-md border border-info/30 bg-info-soft/30 px-3 py-2.5"
          >
            <input
              id="client-inherit-vinculo"
              type="checkbox"
              checked={inheritVinculoOnCreate}
              onChange={(e) => setInheritVinculoOnCreate(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge text-info focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            />
            <span className="text-xs leading-relaxed text-content-soft">
              Criar já com a mesma anotação de vínculo do filtro (só neste aparelho; não muda a nuvem nem o
              financeiro). Desmarque para criar sem anotação.
            </span>
          </label>
        )}
      </form>

      {clientsCount > 0 && (
        <div className="rounded-design-lg border border-edge bg-surface p-3 shadow-design-sm sm:p-4">
          <p className="mb-2 text-xs font-medium text-content-muted">
            Filtrar por anotação de vínculo (local neste aparelho; não é sincronização)
          </p>
          <div
            className="flex flex-col gap-1 rounded-design-md bg-surface-muted p-1 sm:flex-row sm:items-stretch"
            role="group"
            aria-label="Filtro por anotação de vínculo"
          >
            <button
              type="button"
              onClick={() => setLinkFilter(LINK_LIST_FILTER.ALL)}
              className={filterButtonClass(linkFilter === LINK_LIST_FILTER.ALL)}
            >
              Todos ({processedClients.length})
            </button>
            <button
              type="button"
              onClick={() => setLinkFilter(LINK_LIST_FILTER.LINKED)}
              className={filterButtonClass(linkFilter === LINK_LIST_FILTER.LINKED)}
            >
              Com anotação ({linkedCount})
            </button>
            <button
              type="button"
              onClick={() => setLinkFilter(LINK_LIST_FILTER.UNLINKED)}
              className={filterButtonClass(linkFilter === LINK_LIST_FILTER.UNLINKED)}
            >
              Sem anotação ({unlinkedCount})
            </button>
          </div>

          {operationalLinks.length > 0 && linkFilter !== LINK_LIST_FILTER.UNLINKED && (
            <div className="mt-3">
              <label
                htmlFor="client-list-link-id-filter"
                className="mb-1.5 block text-xs font-medium text-content-muted"
              >
                Refinar por vínculo anotado (chave local do par de contas)
              </label>
              <select
                id="client-list-link-id-filter"
                value={localLinkIdFilter}
                onChange={(e) => setLocalLinkIdFilter(e.target.value)}
                className="w-full min-h-[44px] rounded-design-md border border-edge bg-surface-muted px-3 text-sm text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                aria-label="Refinar por vínculo anotado"
              >
                <option value="">
                  Qualquer — {operationalLinks.length} vínculo
                  {operationalLinks.length === 1 ? '' : 's'} distinto
                  {operationalLinks.length === 1 ? '' : 's'} neste aparelho
                </option>
                {operationalLinks.map((opt) => (
                  <option key={opt.linkId} value={opt.linkId}>
                    {opt.label} · {opt.clientCount} cliente(s) · {opt.loanCount} contr. ·{' '}
                    {opt.paymentCount} pag. (só contr. anotados)
                  </option>
                ))}
              </select>
              {localLinkIdFilter && operationalSnapshot && (
                <p className="mt-2 text-[11px] leading-snug text-content-muted">
                  Neste vínculo (somente dados locais deste aparelho): cadastros com anotação no cliente{' '}
                  {operationalSnapshot.clientCount}, contratos anotados {operationalSnapshot.loanCount};{' '}
                  {operationalSnapshot.paymentCount} lançamentos registados apenas em contratos com esta
                  anotação — não existe pagamento próprio nem sync remoto financeiro.
                </p>
              )}
            </div>
          )}

          <div className="mt-3">
            {!batchSelectMode ? (
              <button
                type="button"
                onClick={() => {
                  setBatchSelectMode(true);
                  setSelectedIdList([]);
                }}
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:w-auto"
              >
                Selecionar clientes
              </button>
            ) : (
              <button
                type="button"
                onClick={exitBatchMode}
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-design-md border border-info/30 bg-info-soft/30 px-3 text-sm font-semibold text-info transition-colors hover:bg-info-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:w-auto"
              >
                Concluir seleção
              </button>
            )}
            <p className="mt-1.5 text-xs text-content-muted">
              {batchSelectMode
                ? 'Modo seleção: toque no cliente para marcar. Anotação continua local neste aparelho; não cria vínculo novo na plataforma nem envia dinheiro.'
                : 'Opcional: marque vários clientes e anote ou remova anotação de vínculo (apenas rótulo local).'}
            </p>
          </div>
        </div>
      )}

      {batchSelectMode && clientsCount > 0 && (
        <div
          className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-edge bg-base/95 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-design-md sm:border sm:shadow-design-sm"
          role="region"
          aria-label="Ações em lote (anotação local)"
        >
          <p className="text-xs font-medium text-content">
            {selectedIdList.length} selecionado{selectedIdList.length === 1 ? '' : 's'}
            {localLinkIdFilter && inheritTemplate
              ? ` · vínculo ativo: ${formatLocalVinculoLineFromContext(inheritTemplate)}`
              : localLinkIdFilter
                ? ' · refinamento por vínculo da plataforma'
                : ''}
          </p>
          <p className="text-[11px] leading-snug text-content-muted">
            Não cria vínculo remoto novo nem altera o financeiro.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {visibleClients.length > 0 && (
              <button
                type="button"
                onClick={selectAllVisible}
                className="inline-flex min-h-[40px] items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-xs font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                Marcar visíveis ({visibleClients.length})
              </button>
            )}
            {selectedIdList.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex min-h-[40px] items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-xs font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                Limpar marcação
              </button>
            )}
            {canShowBatchAnnotate && onUpdateClients && (
              <button
                type="button"
                onClick={handleBatchAnnotate}
                disabled={selectedIdList.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
              >
                Anotar selecionados com este vínculo
              </button>
            )}
            {onUpdateClients && (
              <button
                type="button"
                onClick={handleBatchRemove}
                disabled={selectedIdList.length === 0}
                className="inline-flex min-h-[44px] items-center justify-center rounded-design-md border border-edge border-danger/30 bg-danger-soft/30 px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
              >
                Remover anotação (selecionados)
              </button>
            )}
          </div>
          {!localLinkIdFilter && batchSelectMode && linkFilter !== LINK_LIST_FILTER.UNLINKED && (
            <p className="text-xs text-content-muted">
              Para anotar em lote, escolha um vínculo no refinamento &quot;Refinar por vínculo anotado&quot;.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {visibleClients.map((client) => {
          const isSelected = selectedSet.has(client.id);
          return (
            <div
              key={client.id}
              onClick={() => {
                if (batchSelectMode) {
                  toggleClientSelected(client.id);
                } else {
                  onSelectClient(client);
                }
              }}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-design-lg border border-edge bg-surface p-4 shadow-design-sm transition-colors sm:p-5 ${
                batchSelectMode && isSelected ? 'ring-1 ring-inset ring-info/50 bg-info-soft/15' : 'hover:bg-surface-muted'
              }`}
            >
              {batchSelectMode && (
                <div
                  className="shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id={`client-select-${client.id}`}
                    checked={isSelected}
                    onChange={() => toggleClientSelected(client.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-edge text-info focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    aria-label={`Selecionar ${client.name} para anotação em lote`}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold leading-snug text-content">
                  {client.name}
                </p>

                {client.linkContext && (
                  <p
                    className="mt-1.5 line-clamp-2 text-xs text-info"
                    title="Anotação local; não indica situação de pagamento"
                  >
                    {formatLocalVinculoLineFromContext(client.linkContext)}
                  </p>
                )}

                {client.currentDebt > 0 ? (
                  <div className="mt-2">
                    {client.dashPending <= 0 ? (
                      <span className="inline-flex max-w-full items-center rounded-design-sm bg-success-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-success">
                        OK ({client.dashMonthStr}) ✅
                      </span>
                    ) : (
                      <span
                        className={`inline-flex max-w-full items-center rounded-design-sm px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                          client.isNextMonth
                            ? 'bg-info-soft text-info'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        Falta {client.dashMonthStr}: {displayMoney(client.dashPending)}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-content-muted">Sem dívidas ativas</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
                {batchSelectMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClient(client);
                    }}
                    className="inline-flex min-h-[40px] min-w-[5rem] items-center justify-center rounded-design-md border border-edge bg-surface px-2 text-xs font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                  >
                    Abrir ficha
                  </button>
                )}
                <div className="shrink-0 border-l border-edge pl-3 text-right sm:pl-4">
                  <p className="text-xs font-medium text-content-muted">Dívida Total</p>
                  <p
                    className={`mt-0.5 text-base font-bold tabular-nums tracking-tight ${
                      client.currentDebt > 0 ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {displayMoney(client.currentDebt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {clientsCount > 0 && visibleClients.length === 0 && (
          <div className="mt-2 rounded-design-lg border border-dashed border-edge bg-surface-muted/60 px-5 py-10 text-center">
            <p className="text-sm text-content-muted">{emptyStateMessage()}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex min-h-[44px] items-center justify-center rounded-design-md border border-edge bg-surface px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                Limpar filtros
              </button>
              {localLinkIdFilter && linkFilter !== LINK_LIST_FILTER.UNLINKED && (
                <button
                  type="button"
                  onClick={() => setLocalLinkIdFilter('')}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-design-md border border-edge border-info/30 bg-info-soft/40 px-4 text-sm font-semibold text-info transition-colors hover:bg-info-soft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                >
                  Só o refinamento de vínculo
                </button>
              )}
            </div>
          </div>
        )}

        {clientsCount === 0 && (
          <div className="mt-10 rounded-design-lg border border-dashed border-edge bg-surface-muted/60 px-5 py-12 text-center">
            <p className="text-sm text-content-muted">Nenhum cliente cadastrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientsList;
