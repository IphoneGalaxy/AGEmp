import React, { useState, useMemo } from 'react';
import { generateId } from '../utils/ids';
import {
  filterClientsByLinkContextPresence,
  LINK_LIST_FILTER,
} from '../utils/clientLinkListFilter';

/**
 * Componente Lista de Clientes.
 *
 * Exibe:
 * - Formulário para adicionar novo cliente
 * - Filtro local opcional por presença de anotação de vínculo (linkContext)
 * - Lista de clientes com status de pagamento e dívida total
 * - Badges de status (OK, Falta, Sem dívidas)
 *
 * @param {Object} props
 * @param {Array}    props.processedClients - Clientes com dados processados.
 * @param {number}   props.clientsCount - Quantidade total de clientes.
 * @param {Function} props.onAddClient - Callback para adicionar novo cliente.
 * @param {Function} props.onSelectClient - Callback para selecionar/abrir um cliente.
 * @param {Function} props.showToast - Callback para exibir notificação toast.
 * @param {Function} props.displayMoney - Função para formatar/ocultar valores monetários.
 */
const ClientsList = ({
  processedClients,
  clientsCount,
  onAddClient,
  onSelectClient,
  showToast,
  displayMoney,
}) => {
  const [newClientName, setNewClientName] = useState('');
  const [linkFilter, setLinkFilter] = useState(LINK_LIST_FILTER.ALL);

  const linkedCount = useMemo(
    () => processedClients.filter((c) => c?.linkContext).length,
    [processedClients]
  );
  const unlinkedCount = useMemo(
    () => Math.max(0, processedClients.length - linkedCount),
    [processedClients, linkedCount]
  );

  const visibleClients = useMemo(
    () => filterClientsByLinkContextPresence(processedClients, linkFilter),
    [processedClients, linkFilter]
  );

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    onAddClient({ id: generateId(), name: newClientName, loans: [] });
    setNewClientName('');
    showToast('👤 Cliente criado!');
  };

  const filterButtonClass = (active) =>
    `inline-flex min-h-[40px] flex-1 items-center justify-center rounded-design-md px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:text-sm ${
      active
        ? 'bg-surface text-info shadow-design-sm ring-1 ring-inset ring-info/35'
        : 'bg-transparent text-content-muted hover:bg-surface/80'
    }`;

  return (
    <div className="p-4 space-y-6 pb-20">
      <form
        onSubmit={handleAddClient}
        className="mb-6 flex gap-2 rounded-design-lg border border-edge bg-surface p-4 shadow-design-sm"
      >
        <input
          type="text"
          required
          className="min-h-[44px] flex-1 rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-content placeholder:text-content-muted shadow-none"
          placeholder="Nome do novo cliente"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-design-md bg-primary px-5 font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover"
        >
          Criar
        </button>
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
        </div>
      )}

      <div className="space-y-3">
        {visibleClients.map((client) => (
          <div
            key={client.id}
            onClick={() => onSelectClient(client)}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm transition-colors hover:bg-surface-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-snug text-content">
                {client.name}
              </p>

              {client.linkContext && (
                <p className="mt-1.5 text-xs font-medium text-info" title="Anotação local; não indica saldo">
                  Vínculo anotado (local)
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
            <div className="shrink-0 border-l border-edge pl-4 text-right">
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
        ))}

        {clientsCount > 0 && visibleClients.length === 0 && (
          <div className="mt-2 rounded-design-lg border border-dashed border-edge bg-surface-muted/60 px-5 py-10 text-center">
            <p className="text-sm text-content-muted">
              Nenhum cliente corresponde a este filtro neste escopo local de dados.
            </p>
            <button
              type="button"
              onClick={() => setLinkFilter(LINK_LIST_FILTER.ALL)}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-design-md border border-edge bg-surface px-4 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Ver todos
            </button>
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
