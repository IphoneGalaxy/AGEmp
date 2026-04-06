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
      <form onSubmit={handleAddClient} className="flex gap-2 mb-6">
        <input
          type="text"
          required
          className="flex-1 bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-3"
          placeholder="Nome do novo cliente"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-5 py-3 rounded-xl font-medium shadow-md"
        >
          Criar
        </button>
      </form>

      <div className="space-y-3">
        {processedClients.map((client) => (
          <div
            key={client.id}
            onClick={() => onSelectClient(client)}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-lg">{client.name}</p>

              {client.currentDebt > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  {client.dashPending <= 0 ? (
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      OK ({client.dashMonthStr}) ✅
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        client.isNextMonth
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      Falta {client.dashMonthStr}: {displayMoney(client.dashPending)}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Sem dívidas ativas</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Dívida Total</p>
              <p
                className={`font-bold ${
                  client.currentDebt > 0 ? 'text-red-500' : 'text-green-600'
                }`}
              >
                {displayMoney(client.currentDebt)}
              </p>
            </div>
          </div>
        ))}
        {clientsCount === 0 && (
          <p className="text-center text-gray-500 mt-10">Nenhum cliente cadastrado.</p>
        )}
      </div>
    </div>
  );
};

export default ClientsList;
