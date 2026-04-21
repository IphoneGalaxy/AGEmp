import React, { useState } from 'react';
import { generateId } from '../utils/ids';

/**
 * Componente Lista de Clientes.
 *
 * Exibe:
 * - Formulário para adicionar novo cliente
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

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    onAddClient({ id: generateId(), name: newClientName, loans: [] });
    setNewClientName('');
    showToast('👤 Cliente criado!');
  };

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

      <div className="space-y-3">
        {processedClients.map((client) => (
          <div
            key={client.id}
            onClick={() => onSelectClient(client)}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm transition-colors hover:bg-surface-muted"
          >
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-snug text-content">
                {client.name}
              </p>

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
