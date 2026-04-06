import React, { useState } from 'react';
import { formatMoney, formatDate, formatRate } from '../utils/format';
import { generateId } from '../utils/ids';
import { IconEdit, IconDelete, IconBack } from './Icons';

/**
 * Componente Visão do Cliente (overlay).
 *
 * Exibe detalhes do cliente, contratos, pagamentos, edição/exclusão.
 * Suporta taxa de juros individual por contrato.
 *
 * @param {Object} props
 * @param {Object}   props.clientData - Dados processados do cliente.
 * @param {number}   props.availableMoney - Saldo disponível em caixa.
 * @param {Function} props.onUpdateClients - Callback updater de clientes.
 * @param {Function} props.onClose - Callback para fechar a visão.
 * @param {Function} props.showToast - Callback para exibir toast.
 * @param {Function} props.displayMoney - Função para formatar/ocultar valores monetários.
 * @param {Object}   props.settings - Configurações da aplicação.
 */
const ClientView = ({
  clientData,
  availableMoney,
  onUpdateClients,
  onClose,
  showToast,
  displayMoney,
  settings,
}) => {
  // --- Estado local de formulários ---
  const [showNewLoanForm, setShowNewLoanForm] = useState(false);
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [newLoanDate, setNewLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLoanRate, setNewLoanRate] = useState(
    settings.defaultInterestRate !== '' ? settings.defaultInterestRate : 10
  );

  const [payingLoanId, setPayingLoanId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // --- Estado local de confirmações e edições ---
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [confirmDeleteLoanId, setConfirmDeleteLoanId] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState(null);

  // ==================== HANDLERS ====================

  const handleDeleteClientClick = () => {
    if (settings.confirmDeleteClient) {
      setConfirmDeleteClient(true);
    } else {
      executeDeleteClient();
    }
  };

  const executeDeleteClient = () => {
    onUpdateClients((clients) => clients.filter((c) => c.id !== clientData.id));
    onClose();
    showToast('🗑️ Cliente deletado.');
  };

  const handleAddLoan = (e) => {
    e.preventDefault();
    const amountToLend = Number(newLoanAmount);
    if (!amountToLend || amountToLend <= 0) return;

    const rate = Number(newLoanRate);
    if (isNaN(rate) || rate < 0) {
      showToast('❌ Taxa de juros inválida!');
      return;
    }

    if (amountToLend > availableMoney) {
      showToast('❌ Saldo insuficiente para este empréstimo!');
      return;
    }

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: [
              {
                id: generateId(),
                date: newLoanDate,
                amount: amountToLend,
                interestRate: rate,
                payments: [],
              },
              ...c.loans,
            ],
          };
        }
        return c;
      })
    );
    setNewLoanAmount('');
    setNewLoanRate(settings.defaultInterestRate !== '' ? settings.defaultInterestRate : 10);
    setShowNewLoanForm(false);
    showToast('💸 Empréstimo registrado!');
  };

  const handleDeleteLoanClick = (loanId) => {
    if (settings.confirmDeleteLoan) {
      setConfirmDeleteLoanId(loanId);
    } else {
      executeDeleteLoan(loanId);
    }
  };

  const executeDeleteLoan = (loanId) => {
    onUpdateClients((clients) =>
      clients.map((c) =>
        c.id === clientData.id ? { ...c, loans: c.loans.filter((l) => l.id !== loanId) } : c
      )
    );
    setConfirmDeleteLoanId(null);
    showToast('🗑️ Contrato apagado.');
  };

  const handleSaveEditLoan = (e) => {
    e.preventDefault();
    const newAmount = Number(editingLoan.amount);
    if (!newAmount || newAmount <= 0) return;

    const newRate = Number(editingLoan.interestRate);
    if (isNaN(newRate) || newRate < 0) {
      showToast('❌ Taxa de juros inválida!');
      return;
    }

    const originalLoan = clientData.loans.find((l) => l.id === editingLoan.id);
    const diff = newAmount - originalLoan.amount;
    if (diff > 0 && diff > availableMoney) {
      showToast('❌ Saldo insuficiente para aumentar o empréstimo!');
      return;
    }

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === editingLoan.id
                ? { ...l, date: editingLoan.date, amount: newAmount, interestRate: newRate }
                : l
            ),
          };
        }
        return c;
      })
    );
    setEditingLoan(null);
    showToast('✅ Contrato editado!');
  };

  const handleAddPayment = (e) => {
    e.preventDefault();
    if (!paymentAmount) return;

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === payingLoanId
                ? {
                    ...l,
                    payments: [
                      ...l.payments,
                      { id: generateId(), date: paymentDate, amount: Number(paymentAmount) },
                    ],
                  }
                : l
            ),
          };
        }
        return c;
      })
    );
    setPaymentAmount('');
    setPayingLoanId(null);
    showToast('✅ Pagamento registrado!');
  };

  const handleDeletePaymentClick = (loanId, paymentId) => {
    if (settings.confirmDeletePayment) {
      setConfirmDeletePaymentId({ loanId, id: paymentId });
    } else {
      // Executa direto sem confirmação
      onUpdateClients((clients) =>
        clients.map((c) => {
          if (c.id === clientData.id) {
            return {
              ...c,
              loans: c.loans.map((l) =>
                l.id === loanId ? { ...l, payments: l.payments.filter((p) => p.id !== paymentId) } : l
              ),
            };
          }
          return c;
        })
      );
      showToast('🗑️ Pagamento apagado.');
    }
  };

  const executeDeletePayment = () => {
    if (!confirmDeletePaymentId) return;
    const { loanId, id } = confirmDeletePaymentId;

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === loanId ? { ...l, payments: l.payments.filter((p) => p.id !== id) } : l
            ),
          };
        }
        return c;
      })
    );
    setConfirmDeletePaymentId(null);
    showToast('🗑️ Pagamento apagado.');
  };

  const handleSaveEditPayment = (e) => {
    e.preventDefault();
    if (!editingPayment.amount) return;

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === editingPayment.loanId
                ? {
                    ...l,
                    payments: l.payments.map((p) =>
                      p.id === editingPayment.id
                        ? { ...p, date: editingPayment.date, amount: Number(editingPayment.amount) }
                        : p
                    ),
                  }
                : l
            ),
          };
        }
        return c;
      })
    );
    setEditingPayment(null);
    showToast('✅ Pagamento editado!');
  };

  // Extrato usa formatMoney (não displayMoney) — dados copiados devem ser legíveis
  const generateStatement = () => {
    let text = `*Extrato de Empréstimos - ${clientData.name}*\n`;
    text += `Gerado em: ${formatDate(new Date().toISOString().split('T')[0])}\n\n`;

    if (clientData.loans.length === 0) text += `Nenhum contrato ativo.\n`;

    clientData.loans.forEach((loan) => {
      const rateStr = formatRate(loan.interestRate != null ? loan.interestRate : 10);
      text += `📌 *Empréstimo: ${formatMoney(loan.amount)} (${formatDate(loan.date)}) — Taxa: ${rateStr}*\n`;
      if (loan.isPaidOff) {
        text += `   ✅ Contrato Quitado!\n\n`;
      } else {
        if (loan.processedPayments.length > 0) {
          loan.processedPayments.forEach((p) => {
            text += `   🟢 ${formatDate(p.date)}: Pagou ${formatMoney(p.amount)}\n`;
            text += `      (Juros: ${formatMoney(p.interestPaid)} | Abateu: ${formatMoney(p.amortized)})\n`;
          });
        } else {
          text += `   ▪️ Nenhum pagamento registrado.\n`;
        }
        text += `   *Saldo Devedor Deste:* ${formatMoney(loan.currentPrincipal)}\n`;
        text += `   *(Próx. Juros ${rateStr}: ${formatMoney(loan.baseInterest)})*\n`;
        text += `   *🎯 QUITAÇÃO DESTE: ${formatMoney(loan.currentPrincipal + loan.baseInterest)}*\n\n`;
      }
    });

    text += `------------------------\n`;
    text += `*TOTAL DEVEDOR (PRINCIPAL): ${formatMoney(clientData.currentDebt)}*\n`;
    text += `*🎯 TOTAL PARA QUITAR TUDO: ${formatMoney(clientData.currentDebt + clientData.dashExpected)}*\n`;

    // Copia para o clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast('📋 Extrato copiado com sucesso!'),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('📋 Extrato copiado com sucesso!');
    } catch (err) {
      showToast('❌ Erro ao copiar.');
    }
    document.body.removeChild(textArea);
  };

  // ==================== RENDERIZAÇÃO ====================

  return (
    <div className="p-4 flex flex-col h-screen bg-gray-50 absolute top-0 left-0 w-full z-10 overflow-y-auto pb-24">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 bg-white rounded-full shadow text-gray-600 active:bg-gray-100"
          >
            <IconBack />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{clientData.name}</h2>
        </div>
        <button
          onClick={handleDeleteClientClick}
          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
        >
          <IconDelete />
        </button>
      </div>

      {/* Confirmação de exclusão do cliente */}
      {confirmDeleteClient && (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 mb-6 text-center animate-fade-in shadow-sm">
          <p className="text-red-800 font-bold mb-3">Apagar cliente e todo o histórico?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteClient(false)}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={executeDeleteClient}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-sm"
            >
              Sim, Apagar
            </button>
          </div>
        </div>
      )}

      {/* Resumo de dívida */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 text-center">
        <p className="text-gray-500 text-sm font-medium mb-1">Dívida Principal (Todos contratos)</p>
        <p className="text-3xl font-black text-gray-800">{displayMoney(clientData.currentDebt)}</p>

        <div className="mt-3 inline-block bg-blue-100 text-blue-900 px-5 py-2.5 rounded-xl text-md font-bold w-full shadow-sm border border-blue-200">
          Quitação Total de Tudo: {displayMoney(clientData.currentDebt + clientData.dashExpected)}
        </div>

        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={() => setShowNewLoanForm(!showNewLoanForm)}
            className="flex-1 bg-blue-600 text-white px-3 py-2.5 rounded-xl text-sm font-bold shadow-sm"
          >
            + Empréstimo
          </button>
          <button
            onClick={generateStatement}
            className="flex-1 bg-gray-800 text-white px-3 py-2.5 rounded-xl text-sm font-bold shadow-sm"
          >
            Copiar Extrato
          </button>
        </div>
      </div>

      {/* Formulário de novo empréstimo */}
      {showNewLoanForm && (
        <form
          onSubmit={handleAddLoan}
          className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200 mb-6 animate-fade-in"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-800">Novo Empréstimo</h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-medium">
              Caixa: {displayMoney(availableMoney)}
            </span>
          </div>
          <input
            type="date"
            value={newLoanDate}
            onChange={(e) => setNewLoanDate(e.target.value)}
            required
            className="w-full mb-3 p-3 border rounded-xl bg-gray-50"
          />
          <input
            type="number"
            step="0.01"
            value={newLoanAmount}
            onChange={(e) => setNewLoanAmount(e.target.value)}
            placeholder="Valor (R$)"
            required
            className="w-full mb-3 p-3 border rounded-xl bg-gray-50"
          />
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Taxa de juros:</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={newLoanRate}
              onChange={(e) => setNewLoanRate(e.target.value)}
              required
              className="w-20 p-3 border rounded-xl bg-gray-50 text-center font-bold"
            />
            <span className="text-sm text-gray-500 font-medium">%</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewLoanForm(false)}
              className="flex-1 p-3 bg-gray-100 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button type="submit" className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">
              Salvar
            </button>
          </div>
        </form>
      )}

      <h3 className="font-bold text-gray-800 mb-3 ml-1">Contratos em Aberto</h3>

      {/* Lista de contratos */}
      <div className="space-y-4">
        {clientData.loans.map((loan) => {
          const loanRateDisplay = formatRate(loan.interestRate != null ? loan.interestRate : 10);

          return (
            <div
              key={loan.id}
              className={`bg-white rounded-2xl shadow-sm border-2 ${
                loan.isPaidOff ? 'border-green-200 opacity-70' : 'border-gray-200'
              } overflow-hidden relative`}
            >
              {/* Cabeçalho: edição / exclusão / normal */}
              {editingLoan && editingLoan.id === loan.id ? (
                <form
                  onSubmit={handleSaveEditLoan}
                  className="p-4 bg-gray-100 border-b border-gray-200 animate-fade-in"
                >
                  <p className="text-xs font-bold text-blue-700 mb-2">Editando Contrato</p>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="date"
                      required
                      value={editingLoan.date}
                      onChange={(e) => setEditingLoan({ ...editingLoan, date: e.target.value })}
                      className="w-1/3 p-2 border rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editingLoan.amount}
                      onChange={(e) => setEditingLoan({ ...editingLoan, amount: e.target.value })}
                      className="flex-1 p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-gray-600 font-medium">Taxa:</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={editingLoan.interestRate}
                      onChange={(e) =>
                        setEditingLoan({ ...editingLoan, interestRate: e.target.value })
                      }
                      className="w-16 p-2 border rounded-lg text-sm text-center"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingLoan(null)}
                      className="flex-1 py-1.5 bg-gray-200 rounded-lg text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              ) : confirmDeleteLoanId === loan.id ? (
                <div className="p-4 bg-red-50 border-b border-red-200 animate-fade-in text-center">
                  <p className="text-sm font-bold text-red-700 mb-2">Apagar contrato inteiro?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeleteLoanId(null)}
                      className="flex-1 py-1.5 bg-gray-200 rounded-lg text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => executeDeleteLoan(loan.id)}
                      className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold"
                    >
                      Sim, Apagar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center relative">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">
                      Data: {formatDate(loan.date)}
                    </p>
                    <p className="font-black text-gray-800 text-lg">
                      Empréstimo: {displayMoney(loan.amount)}
                    </p>
                    <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                      Taxa deste contrato: {loanRateDisplay}
                    </p>
                  </div>

                  {!loan.isPaidOff && (
                    <div className="absolute top-2 right-2">
                      {loan.isLoanOK ? (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase">
                          OK ({loan.loanDisplayMonthStr}) ✅
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm animate-pulse uppercase">
                          FALTA {loan.loanDisplayMonthStr}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 text-gray-400 mt-6">
                    <button
                      onClick={() =>
                        setEditingLoan({
                          id: loan.id,
                          date: loan.date,
                          amount: loan.amount,
                          interestRate: loan.interestRate != null ? loan.interestRate : 10,
                        })
                      }
                      className="hover:text-blue-600"
                    >
                      <IconEdit />
                    </button>
                    <button
                      onClick={() => handleDeleteLoanClick(loan.id)}
                      className="hover:text-red-500"
                    >
                      <IconDelete />
                    </button>
                  </div>
                </div>
              )}

              {/* Corpo do contrato */}
              <div className="p-4">
                {loan.isPaidOff ? (
                  <div className="text-center py-2 text-green-600 font-bold bg-green-50 rounded-lg">
                    ✅ Contrato Quitado!
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Saldo Devedor (Principal):</p>
                        <p className="text-xl font-bold text-red-600">
                          {displayMoney(loan.currentPrincipal)}
                        </p>
                      </div>
                      <button
                        onClick={() => setPayingLoanId(loan.id)}
                        className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-green-200"
                      >
                        + Pagar Este
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-orange-50 px-3 py-2 rounded-lg border border-orange-100 mb-4">
                      <p className="text-xs text-orange-800 font-medium">
                        Juros ({loanRateDisplay}): {displayMoney(loan.baseInterest)}
                      </p>
                      <p className="text-sm text-orange-900 font-black">
                        Quitação: {displayMoney(loan.currentPrincipal + loan.baseInterest)}
                      </p>
                    </div>

                    {/* Formulário de pagamento */}
                    {payingLoanId === loan.id && (
                      <form
                        onSubmit={handleAddPayment}
                        className="mb-4 bg-white shadow-md p-4 rounded-xl border border-gray-200 animate-fade-in relative z-10"
                      >
                        <p className="text-sm font-bold text-gray-800 mb-3">Novo Pagamento</p>
                        <div className="flex gap-2 mb-3">
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                            className="w-1/3 p-2 border rounded-lg bg-gray-50 text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="Valor (R$)"
                            required
                            className="flex-1 p-2 border rounded-lg bg-gray-50 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPayingLoanId(null)}
                            className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-bold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold"
                          >
                            Confirmar
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}

                {/* Lista de pagamentos */}
                {loan.processedPayments.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Pagamentos:</p>
                    <div className="space-y-2">
                      {[...loan.processedPayments].reverse().map((p) => (
                        <div key={p.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          {editingPayment && editingPayment.id === p.id ? (
                            <form onSubmit={handleSaveEditPayment} className="animate-fade-in">
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="date"
                                  required
                                  value={editingPayment.date}
                                  onChange={(e) =>
                                    setEditingPayment({ ...editingPayment, date: e.target.value })
                                  }
                                  className="w-1/3 p-1 border rounded text-xs"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={editingPayment.amount}
                                  onChange={(e) =>
                                    setEditingPayment({ ...editingPayment, amount: e.target.value })
                                  }
                                  className="flex-1 p-1 border rounded text-xs"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPayment(null)}
                                  className="flex-1 bg-gray-200 rounded text-[10px] font-bold py-1"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  className="flex-1 bg-blue-600 text-white rounded text-[10px] font-bold py-1"
                                >
                                  Salvar
                                </button>
                              </div>
                            </form>
                          ) : confirmDeletePaymentId?.id === p.id ? (
                            <div className="animate-fade-in flex flex-col gap-2">
                              <p className="text-xs text-red-600 font-bold text-center">
                                Apagar pagamento?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmDeletePaymentId(null)}
                                  className="flex-1 bg-gray-200 rounded text-[10px] font-bold py-1"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={executeDeletePayment}
                                  className="flex-1 bg-red-600 text-white rounded text-[10px] font-bold py-1"
                                >
                                  Apagar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  <span className="font-bold text-sm text-gray-700">
                                    {displayMoney(p.amount)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 ml-1">
                                    ({formatDate(p.date)})
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 ml-3 mt-0.5">
                                  Juros: {displayMoney(p.interestPaid)} | Abateu:{' '}
                                  {displayMoney(p.amortized)}
                                </p>
                              </div>
                              <div className="flex gap-2 text-gray-400">
                                <button
                                  onClick={() =>
                                    setEditingPayment({
                                      loanId: loan.id,
                                      id: p.id,
                                      date: p.date,
                                      amount: p.amount,
                                    })
                                  }
                                  className="hover:text-blue-600 p-1"
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  onClick={() => handleDeletePaymentClick(loan.id, p.id)}
                                  className="hover:text-red-500 p-1"
                                >
                                  <IconDelete />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {clientData.loans.length === 0 && (
          <p className="text-center text-gray-400 py-10">Nenhum contrato ativo.</p>
        )}
      </div>
    </div>
  );
};

export default ClientView;
