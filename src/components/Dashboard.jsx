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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-design-lg border border-edge bg-surface p-5 shadow-design-md">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-primary"
            aria-hidden
          />
          <p className="relative z-10 text-sm font-medium text-content-muted">
            Total Disponível
          </p>
          <p className="relative z-10 mt-1 text-2xl font-bold tabular-nums tracking-tight text-content">
            {displayMoney(globalStats.availableMoney)}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-design-lg border border-edge bg-surface-muted p-5 shadow-design-sm">
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-warning/50"
            aria-hidden
          />
          <p className="relative z-10 text-sm font-medium text-content-muted">
            Total na Rua
          </p>
          <p className="relative z-10 mt-1 text-xl font-semibold tabular-nums tracking-tight text-content-soft">
            {displayMoney(globalStats.totalLent)}
          </p>
        </div>
      </div>

      {/* Recebimentos do Mês */}
      <div className="rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-content">
            Mês de {globalStats.dashMonthStr}
          </h3>
        </div>

        <div className="mb-5 rounded-design-md border border-edge bg-danger-soft px-4 py-5 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-danger">
            Falta Receber (Pendentes)
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-danger">
            {displayMoney(globalStats.dashPending)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-design-md border border-edge bg-success-soft px-3 py-4 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Já Recebido
            </p>
            <p className="text-lg font-bold tabular-nums text-success">
              {displayMoney(globalStats.dashPaid)}
            </p>
          </div>
          <div className="rounded-design-md border border-edge bg-surface-muted px-3 py-4 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Meta do Mês
            </p>
            <p className="text-lg font-bold tabular-nums text-content">
              {displayMoney(globalStats.dashExpected)}
            </p>
          </div>
        </div>
      </div>

      {/* Movimentar Caixa */}
      <div className="rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm">
        <h3 className="mb-4 text-lg font-semibold text-content">
          Movimentar Caixa Pessoal
        </h3>
        <div className="flex flex-col gap-3">
          <input
            type="number"
            step="0.01"
            className="w-full min-h-[44px] rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-content placeholder:text-content-muted"
            placeholder="Valor (R$)"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleFund('add')}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge-strong bg-surface-muted font-semibold text-content transition-colors hover:bg-surface"
            >
              + Adicionar
            </button>
            <button
              onClick={() => handleFund('remove')}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-danger/25 bg-danger-soft font-semibold text-danger"
            >
              - Retirar
            </button>
          </div>
        </div>

        {fundsTransactions.length > 0 && (
          <div className="mt-5 border-t border-edge pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Histórico do Caixa:
            </h3>
            <div className="space-y-2">
              {fundsTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-design-md border border-edge bg-surface-muted px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        t.amount > 0
                          ? 'bg-primary-soft text-primary'
                          : 'bg-danger-soft text-danger'
                      }`}
                    >
                      {t.amount > 0 ? '+' : '-'}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-base font-bold tabular-nums text-content">
                        {displayMoney(Math.abs(t.amount))}
                      </p>
                      <p className="text-xs text-content-muted">{formatDate(t.date)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteFundTransaction(t.id);
                      showToast('🗑️ Registro apagado.');
                    }}
                    className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-design-md p-2 text-content-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    aria-label="Excluir registro do histórico de caixa"
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
