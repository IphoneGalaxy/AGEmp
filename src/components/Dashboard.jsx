import React, { useState } from 'react';
import { formatDate } from '../utils/format';
import { generateId } from '../utils/ids';
import { IconDelete } from './Icons';

/**
 * Componente Dashboard — Painel principal.
 *
 * Exibe:
 * - Cards de resumo financeiro (disponível / na rua)
 * - Recebimentos do mês (pendentes, recebidos, meta)
 * - Movimentação de caixa pessoal
 *
 * @param {Object} props
 * @param {Object}   props.globalStats - Estatísticas globais calculadas.
 * @param {Array}    props.fundsTransactions - Lista de transações do caixa.
 * @param {Function} props.onAddFundTransaction - Callback para adicionar transação.
 * @param {Function} props.onDeleteFundTransaction - Callback para remover transação por ID.
 * @param {Function} props.showToast - Callback para exibir notificação toast.
 * @param {Function} props.displayMoney - Função para formatar/ocultar valores monetários.
 */
const Dashboard = ({
  globalStats,
  fundsTransactions,
  onAddFundTransaction,
  onDeleteFundTransaction,
  showToast,
  displayMoney,
}) => {
  const [addAmount, setAddAmount] = useState('');

  const handleFund = (action) => {
    if (!addAmount || Number(addAmount) <= 0) return;
    let val = Number(addAmount);
    if (action === 'remove') {
      if (val > globalStats.availableMoney) {
        showToast('❌ Saldo insuficiente para essa retirada.');
        return;
      }
      val = -val;
    }
    onAddFundTransaction({
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      amount: val,
    });
    setAddAmount('');
    showToast(action === 'add' ? '💰 Saldo adicionado!' : '💸 Saldo retirado!');
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      {/* Cards Principais */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-600 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <p className="text-blue-100 text-sm font-medium relative z-10">Total Disponível</p>
          <p className="text-2xl font-bold mt-1 relative z-10">
            {displayMoney(globalStats.availableMoney)}
          </p>
        </div>
        <div className="bg-orange-500 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <p className="text-orange-100 text-sm font-medium relative z-10">Total na Rua</p>
          <p className="text-2xl font-bold mt-1 relative z-10">
            {displayMoney(globalStats.totalLent)}
          </p>
        </div>
      </div>

      {/* Recebimentos do Mês */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">Mês de {globalStats.dashMonthStr}</h3>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center mb-4">
          <p className="text-red-700 text-xs font-black uppercase tracking-widest mb-1">
            Falta Receber (Pendentes)
          </p>
          <p className="text-4xl font-black text-red-600">
            {displayMoney(globalStats.dashPending)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
            <p className="text-[10px] text-green-700 font-bold uppercase mb-1">Já Recebido</p>
            <p className="font-bold text-green-800 text-sm">
              {displayMoney(globalStats.dashPaid)}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Meta do Mês</p>
            <p className="font-bold text-gray-700 text-sm">
              {displayMoney(globalStats.dashExpected)}
            </p>
          </div>
        </div>
      </div>

      {/* Movimentar Caixa */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Movimentar Caixa Pessoal</h3>
        <div className="flex flex-col gap-3">
          <input
            type="number"
            step="0.01"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
            placeholder="Valor (R$)"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleFund('add')}
              className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-bold"
            >
              + Adicionar
            </button>
            <button
              onClick={() => handleFund('remove')}
              className="flex-1 bg-red-100 text-red-700 py-3 rounded-xl font-bold shadow-sm"
            >
              - Retirar
            </button>
          </div>
        </div>

        {fundsTransactions.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Histórico do Caixa:</h3>
            <div className="space-y-2">
              {fundsTransactions.map((t) => (
                <div
                  key={t.id}
                  className="bg-gray-50 p-2 rounded-lg flex justify-between items-center border border-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 text-xs rounded-full flex items-center justify-center font-bold ${
                        t.amount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {t.amount > 0 ? '+' : '-'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">
                        {displayMoney(Math.abs(t.amount))}
                      </p>
                      <p className="text-[10px] text-gray-400">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onDeleteFundTransaction(t.id);
                      showToast('🗑️ Registro apagado.');
                    }}
                    className="p-2 text-gray-400 hover:text-red-600"
                  >
                    <IconDelete />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
