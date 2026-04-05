/**
 * Motor de Cálculos do sistema de empréstimos.
 *
 * Processa todos os clientes, empréstimos e pagamentos para gerar
 * estatísticas globais e dados processados para exibição.
 *
 * REGRAS DE NEGÓCIO (não alterar):
 * - Juros fixos de 10% sobre o saldo devedor (principal)
 * - Pagamento cobre primeiro os juros, depois amortiza o principal
 * - Empréstimos feitos no mês corrente só geram expectativa no mês seguinte
 * - Se todos os juros do mês atual estão pagos, exibe dados do próximo mês
 */

import { capitalize } from './format';

/**
 * Calcula todas as estatísticas globais a partir dos dados brutos.
 *
 * @param {Array} clients - Lista de clientes com empréstimos e pagamentos.
 * @param {Array} fundsTransactions - Transações manuais do caixa.
 * @param {Object} timeInfo - Informações temporais do sistema.
 * @param {number} timeInfo.currentMonth - Mês atual (0-11).
 * @param {number} timeInfo.currentYear - Ano atual.
 * @param {number} timeInfo.nextMonth - Próximo mês (0-11).
 * @param {number} timeInfo.nextYear - Ano do próximo mês.
 * @param {Date} timeInfo.today - Data de hoje.
 * @param {Date} timeInfo.nextMonthDate - Objeto Date do 1º dia do próximo mês.
 * @returns {Object} Estatísticas globais processadas.
 */
export const calculateGlobalStats = (clients, fundsTransactions, timeInfo) => {
  const { currentMonth, currentYear, nextMonth, nextYear, today, nextMonthDate } = timeInfo;

  const manualFunds = fundsTransactions.reduce((acc, t) => acc + t.amount, 0);

  let totalLent = 0;
  let totalInterestReceived = 0;
  let totalAmortizedReceived = 0;
  let totalLoansGiven = 0;

  let totalExpectedThisMonth = 0;
  let totalPaidThisMonth = 0;
  let totalExpectedNextMonth = 0;
  let totalPaidNextMonth = 0;

  const processedClients = clients.map((client) => {
    let clientTotalDebt = 0;
    let cExpectedThis = 0;
    let cPaidThis = 0;
    let cExpectedNext = 0;
    let cPaidNext = 0;

    const processedLoans = (client.loans || [])
      .map((loan) => {
        let principal = loan.amount;
        totalLoansGiven += loan.amount;

        let lPaidThis = 0;
        let lPaidNext = 0;

        const [lYearStr, lMonthStr] = loan.date.split('-');
        const loanMonth = Number(lMonthStr) - 1;
        const loanYear = Number(lYearStr);

        const sortedPayments = [...loan.payments].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );

        const processedPayments = sortedPayments.map((p) => {
          const interestDue = principal * 0.1;
          let interestPaid = 0;
          let amortized = 0;

          if (p.amount >= interestDue) {
            interestPaid = interestDue;
            amortized = p.amount - interestDue;
          } else {
            interestPaid = p.amount;
            amortized = 0;
          }

          principal -= amortized;
          if (principal < 0) principal = 0;

          totalInterestReceived += interestPaid;
          totalAmortizedReceived += amortized;

          const [pYearStr, pMonthStr] = p.date.split('-');
          const pM = Number(pMonthStr) - 1;
          const pY = Number(pYearStr);

          // Empréstimos do mês corrente não geram expectativa este mês
          const expectsZeroThisMonth =
            loanYear === currentYear && loanMonth === currentMonth;

          if (pY === currentYear && pM === currentMonth) {
            if (expectsZeroThisMonth) {
              lPaidNext += interestPaid;
            } else {
              lPaidThis += interestPaid;
            }
          } else if (pY === nextYear && pM === nextMonth) {
            lPaidNext += interestPaid;
          }

          return { ...p, interestPaid, amortized, balanceAfter: principal };
        });

        let lExpectedThis = 0;
        let lExpectedNext = 0;
        const baseInterest = principal * 0.1;

        if (principal > 0) {
          if (
            loanYear < currentYear ||
            (loanYear === currentYear && loanMonth < currentMonth)
          ) {
            lExpectedThis = baseInterest;
          }
          if (
            loanYear < nextYear ||
            (loanYear === nextYear && loanMonth < nextMonth)
          ) {
            lExpectedNext = baseInterest;
          }
        }

        const lPendingThis = Math.max(0, lExpectedThis - lPaidThis);

        let lDisplayMonthStr = capitalize(
          today.toLocaleString('pt-BR', { month: 'short' })
        ).replace('.', '');
        let isLoanOK = false;
        let loanDashPending = lPendingThis;

        if (principal === 0) {
          isLoanOK = true;
        } else if (lPendingThis === 0) {
          lDisplayMonthStr = capitalize(
            nextMonthDate.toLocaleString('pt-BR', { month: 'short' })
          ).replace('.', '');
          const lPendingNext = Math.max(0, lExpectedNext - lPaidNext);
          loanDashPending = lPendingNext;
          if (lPendingNext === 0) isLoanOK = true;
        }

        clientTotalDebt += principal;
        cExpectedThis += lExpectedThis;
        cPaidThis += lPaidThis;
        cExpectedNext += lExpectedNext;
        cPaidNext += lPaidNext;

        return {
          ...loan,
          processedPayments,
          currentPrincipal: principal,
          isPaidOff: principal <= 0,
          baseInterest,
          loanDisplayMonthStr: lDisplayMonthStr,
          loanDashPending,
          isLoanOK,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const cPendingThis = Math.max(0, cExpectedThis - cPaidThis);
    let cDisplayMonthStr = capitalize(
      today.toLocaleString('pt-BR', { month: 'short' })
    ).replace('.', '');
    let cDisplayExpected = cExpectedThis;
    let cDisplayPending = cPendingThis;
    let cIsNextMonth = false;

    if (clientTotalDebt > 0 && cPendingThis === 0) {
      cDisplayMonthStr = capitalize(
        nextMonthDate.toLocaleString('pt-BR', { month: 'short' })
      ).replace('.', '');
      cDisplayExpected = cExpectedNext;
      cDisplayPending = Math.max(0, cDisplayExpected - cPaidNext);
      cIsNextMonth = true;
    }

    totalLent += clientTotalDebt;
    totalExpectedThisMonth += cExpectedThis;
    totalPaidThisMonth += cPaidThis;
    totalExpectedNextMonth += cExpectedNext;
    totalPaidNextMonth += cPaidNext;

    return {
      ...client,
      currentDebt: clientTotalDebt,
      loans: processedLoans,
      dashMonthStr: cDisplayMonthStr,
      dashExpected: cDisplayExpected,
      dashPending: cDisplayPending,
      isNextMonth: cIsNextMonth,
    };
  });

  const availableMoney =
    manualFunds + totalInterestReceived + totalAmortizedReceived - totalLoansGiven;

  let overPendingThis = Math.max(0, totalExpectedThisMonth - totalPaidThisMonth);
  let dashMonthStr = capitalize(today.toLocaleString('pt-BR', { month: 'long' }));
  let dashExpected = totalExpectedThisMonth;
  let dashPaid = totalPaidThisMonth;
  let dashPending = overPendingThis;

  if (totalLent > 0 && overPendingThis === 0) {
    dashMonthStr = capitalize(nextMonthDate.toLocaleString('pt-BR', { month: 'long' }));
    dashExpected = totalExpectedNextMonth;
    dashPaid = totalPaidNextMonth;
    dashPending = Math.max(0, dashExpected - dashPaid);
  }

  return {
    availableMoney,
    totalLent,
    processedClients,
    dashMonthStr,
    dashExpected,
    dashPaid,
    dashPending,
  };
};
