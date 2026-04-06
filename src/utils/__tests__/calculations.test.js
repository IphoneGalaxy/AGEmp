/**
 * Testes unitários para o Motor de Cálculos (calculations.js).
 *
 * Cobertura:
 * - Cálculo de juros por contrato (taxa padrão e customizada)
 * - Abatimento de principal
 * - Contrato quitado
 * - Pendências do mês
 * - Fallback para contratos sem interestRate
 * - Empréstimo do mês corrente (sem expectativa neste mês)
 * - Dashboard: mês seguinte quando juros do mês estão pagos
 * - Dinheiro disponível (caixa)
 * - Múltiplos clientes e contratos
 */

import { describe, it, expect } from 'vitest';
import { calculateGlobalStats } from '../calculations';

// ==================== HELPERS ====================

/**
 * Cria um timeInfo fixo para testes determinísticos.
 * Simula "hoje = 15 de março de 2025"
 */
const createTimeInfo = (dateStr = '2025-03-15') => {
  const today = new Date(dateStr + 'T12:00:00');
  const currentMonth = today.getMonth();       // 2 (março)
  const currentYear = today.getFullYear();     // 2025
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonth = nextMonthDate.getMonth();  // 3 (abril)
  const nextYear = nextMonthDate.getFullYear();
  return { currentMonth, currentYear, nextMonth, nextYear, today, nextMonthDate };
};

const TIME_INFO = createTimeInfo();

/** Cria um empréstimo de teste. */
const makeLoan = (overrides = {}) => ({
  id: 'loan1',
  date: '2025-01-15',
  amount: 1000,
  interestRate: 10,
  payments: [],
  ...overrides,
});

/** Cria um cliente de teste com um array de empréstimos. */
const makeClient = (loans = [], overrides = {}) => ({
  id: 'client1',
  name: 'Teste',
  loans,
  ...overrides,
});

/** Cria um pagamento de teste. */
const makePayment = (amount, date = '2025-03-10', id = 'pay1') => ({
  id,
  date,
  amount,
});

// ==================== CENÁRIOS BASE ====================

describe('calculateGlobalStats', () => {
  describe('cenários base (sem clientes / sem dados)', () => {
    it('retorna stats zeradas quando não há clientes', () => {
      const result = calculateGlobalStats([], [], TIME_INFO);

      expect(result.availableMoney).toBe(0);
      expect(result.totalLent).toBe(0);
      expect(result.processedClients).toEqual([]);
      expect(result.dashExpected).toBe(0);
      expect(result.dashPaid).toBe(0);
      expect(result.dashPending).toBe(0);
    });

    it('retorna dinheiro disponível baseado somente em transações de caixa', () => {
      const funds = [
        { id: 'f1', date: '2025-01-01', amount: 5000 },
        { id: 'f2', date: '2025-02-01', amount: -500 },
      ];
      const result = calculateGlobalStats([], funds, TIME_INFO);

      expect(result.availableMoney).toBe(4500);
      expect(result.totalLent).toBe(0);
    });

    it('cliente sem empréstimos tem dívida zero', () => {
      const clients = [makeClient([])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pc = result.processedClients[0];

      expect(pc.currentDebt).toBe(0);
      expect(pc.loans).toHaveLength(0);
    });
  });

  // ==================== CONTRATO SEM PAGAMENTOS ====================

  describe('contrato sem pagamentos', () => {
    it('principal permanece intacto', () => {
      const loan = makeLoan({ amount: 1000, interestRate: 10 });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const processedLoan = result.processedClients[0].loans[0];

      expect(processedLoan.currentPrincipal).toBe(1000);
      expect(processedLoan.isPaidOff).toBe(false);
    });

    it('juros base calculados corretamente com taxa 10%', () => {
      const loan = makeLoan({ amount: 1000, interestRate: 10 });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const processedLoan = result.processedClients[0].loans[0];

      expect(processedLoan.baseInterest).toBe(100); // 1000 * 0.10
    });

    it('juros base calculados corretamente com taxa customizada 8.5%', () => {
      const loan = makeLoan({ amount: 2000, interestRate: 8.5 });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const processedLoan = result.processedClients[0].loans[0];

      expect(processedLoan.baseInterest).toBe(170); // 2000 * 0.085
    });

    it('contrato marca como NÃO ok quando juros estão pendentes', () => {
      const loan = makeLoan({ amount: 1000, interestRate: 10, date: '2025-01-15' });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const processedLoan = result.processedClients[0].loans[0];

      expect(processedLoan.isLoanOK).toBe(false);
      expect(processedLoan.loanDashPending).toBe(100);
    });

    it('processedPayments é array vazio', () => {
      const loan = makeLoan();
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const processedLoan = result.processedClients[0].loans[0];

      expect(processedLoan.processedPayments).toHaveLength(0);
    });
  });

  // ==================== PAGAMENTO MENOR QUE OS JUROS ====================

  describe('pagamento menor que os juros', () => {
    it('não amortiza o principal', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(50)], // juros = 100, paga só 50
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.currentPrincipal).toBe(1000);
      expect(pl.processedPayments[0].interestPaid).toBe(50);
      expect(pl.processedPayments[0].amortized).toBe(0);
      expect(pl.processedPayments[0].balanceAfter).toBe(1000);
    });

    it('juros restantes continuam pendentes', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        date: '2025-01-15',
        payments: [makePayment(50, '2025-03-10')],
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      // Esperava 100 de juros, pagou 50. Pendente = 50
      expect(pl.loanDashPending).toBe(50);
      expect(pl.isLoanOK).toBe(false);
    });
  });

  // ==================== PAGAMENTO EXATO DOS JUROS ====================

  describe('pagamento exato dos juros', () => {
    it('cobre juros sem amortizar principal', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(100)], // exatamente os juros
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.currentPrincipal).toBe(1000);
      expect(pl.processedPayments[0].interestPaid).toBe(100);
      expect(pl.processedPayments[0].amortized).toBe(0);
    });

    it('pendência do mês zerada para empréstimo de mês anterior', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        date: '2025-01-15',
        payments: [makePayment(100, '2025-03-10')],
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      // Juros pagos este mês = 100 = esperado → pendente = 0 → avança pra próximo mês
      // Próximo mês: esperado = 100, pago = 0, pendente = 100
      expect(pl.loanDashPending).toBe(100); // pendente do PRÓXIMO mês
    });
  });

  // ==================== PAGAMENTO MAIOR QUE OS JUROS ====================

  describe('pagamento maior que os juros (amortização)', () => {
    it('amortiza o principal corretamente', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(350)], // juros = 100, sobra 250 pra amortizar
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.processedPayments[0].interestPaid).toBe(100);
      expect(pl.processedPayments[0].amortized).toBe(250);
      expect(pl.currentPrincipal).toBe(750);
      expect(pl.processedPayments[0].balanceAfter).toBe(750);
    });

    it('juros base recalculados sobre o novo principal', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(350)], // principal cai pra 750
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.baseInterest).toBe(75); // 750 * 0.10
    });
  });

  // ==================== CONTRATO QUITADO ====================

  describe('contrato quitado', () => {
    it('principal zero quando paga tudo', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(1100)], // 100 juros + 1000 principal
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.currentPrincipal).toBe(0);
      expect(pl.isPaidOff).toBe(true);
      expect(pl.isLoanOK).toBe(true);
      expect(pl.baseInterest).toBe(0);
    });

    it('pagamento acima da quitação não gera principal negativo', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(1500)], // pagou 400 a mais
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.currentPrincipal).toBe(0);
      expect(pl.isPaidOff).toBe(true);
    });

    it('dívida do cliente zerada quando todos os contratos quitados', () => {
      const loan = makeLoan({
        amount: 500,
        interestRate: 10,
        payments: [makePayment(550)],
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pc = result.processedClients[0];

      expect(pc.currentDebt).toBe(0);
    });
  });

  // ==================== MÚLTIPLOS PAGAMENTOS ====================

  describe('múltiplos pagamentos sequenciais', () => {
    it('juros são recalculados sobre o saldo atualizado', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [
          makePayment(200, '2025-02-10', 'p1'), // juros=100, amort=100 → saldo=900
          makePayment(200, '2025-03-10', 'p2'), // juros=90,  amort=110 → saldo=790
        ],
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.processedPayments[0].interestPaid).toBe(100);
      expect(pl.processedPayments[0].amortized).toBe(100);
      expect(pl.processedPayments[0].balanceAfter).toBe(900);

      expect(pl.processedPayments[1].interestPaid).toBe(90);
      expect(pl.processedPayments[1].amortized).toBe(110);
      expect(pl.processedPayments[1].balanceAfter).toBe(790);

      expect(pl.currentPrincipal).toBe(790);
      expect(pl.baseInterest).toBe(79); // 790 * 0.10
    });
  });

  // ==================== TAXA CUSTOMIZADA POR CONTRATO ====================

  describe('taxa de juros customizada por contrato', () => {
    it('taxa 5% calcula juros menores', () => {
      const loan = makeLoan({
        amount: 2000,
        interestRate: 5,
        payments: [makePayment(150)], // juros = 100 (5%), amort = 50
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.processedPayments[0].interestPaid).toBe(100);
      expect(pl.processedPayments[0].amortized).toBe(50);
      expect(pl.currentPrincipal).toBe(1950);
      expect(pl.baseInterest).toBeCloseTo(97.5); // 1950 * 0.05
    });

    it('taxa 15% calcula juros maiores', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 15,
        payments: [],
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.baseInterest).toBe(150); // 1000 * 0.15
    });

    it('cada contrato do mesmo cliente pode ter taxa diferente', () => {
      const loan1 = makeLoan({ id: 'l1', amount: 1000, interestRate: 10, date: '2025-01-10' });
      const loan2 = makeLoan({ id: 'l2', amount: 1000, interestRate: 5, date: '2025-02-10' });
      const clients = [makeClient([loan1, loan2])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pc = result.processedClients[0];

      // Ordenados por data decrescente, loan2 vem primeiro
      const plLoan2 = pc.loans.find((l) => l.id === 'l2');
      const plLoan1 = pc.loans.find((l) => l.id === 'l1');

      expect(plLoan1.baseInterest).toBe(100); // 1000 * 0.10
      expect(plLoan2.baseInterest).toBe(50);  // 1000 * 0.05
    });
  });

  // ==================== FALLBACK: CONTRATO SEM INTERESTRATE ====================

  describe('fallback para contratos antigos sem interestRate', () => {
    it('usa 10% quando interestRate é undefined', () => {
      const loan = { id: 'old', date: '2025-01-15', amount: 1000, payments: [] };
      // interestRate ausente intencionalmente
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.baseInterest).toBe(100); // fallback 10%
    });

    it('usa 10% quando interestRate é null', () => {
      const loan = makeLoan({ interestRate: null });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.baseInterest).toBe(100);
    });

    it('aceita interestRate = 0 (sem juros)', () => {
      const loan = makeLoan({ amount: 1000, interestRate: 0 });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      expect(pl.baseInterest).toBe(0);
    });
  });

  // ==================== EMPRÉSTIMO DO MÊS CORRENTE ====================

  describe('empréstimo do mês corrente', () => {
    it('não gera expectativa de juros este mês', () => {
      // Empréstimo em março (mês corrente do timeInfo)
      const loan = makeLoan({ date: '2025-03-01', amount: 1000, interestRate: 10 });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pl = result.processedClients[0].loans[0];

      // Juros esperados ESTE mês = 0 (empréstimo deste mês)
      // Juros esperados PRÓXIMO mês = 100
      expect(pl.currentPrincipal).toBe(1000);
    });

    it('pagamento no mês de criação conta para o próximo mês', () => {
      const loan = makeLoan({
        date: '2025-03-01',
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(100, '2025-03-15')],
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);

      // O pagamento de 100 no mês de criação vai para lPaidNext (não lPaidThis)
      // pois expectsZeroThisMonth = true
      expect(result.dashPending).toBe(0); // sem pendência
    });
  });

  // ==================== DINHEIRO DISPONÍVEL (CAIXA) ====================

  describe('dinheiro disponível (caixa)', () => {
    it('caixa = depósitos - empréstimos + juros recebidos + principal devolvido', () => {
      const funds = [{ id: 'f1', date: '2025-01-01', amount: 5000 }];
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(300)], // juros=100, amort=200
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, funds, TIME_INFO);

      // 5000 (depósito) - 1000 (emprestou) + 100 (juros) + 200 (amortizado) = 4300
      expect(result.availableMoney).toBe(4300);
    });

    it('totalLent reflete a dívida pendente real', () => {
      const loan = makeLoan({
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(300)], // amort 200, saldo = 800
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);

      expect(result.totalLent).toBe(800); // principal pendente
    });
  });

  // ==================== DASHBOARD: AVANÇO DE MÊS ====================

  describe('dashboard avança para próximo mês quando juros do mês estão pagos', () => {
    it('mostra dados do próximo mês quando pendência do mês atual = 0', () => {
      const loan = makeLoan({
        date: '2025-01-15',
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(100, '2025-03-05')], // paga juros de março
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);

      // Pendência março = 0 → dashboard mostra abril
      // Abril: esperado=100, pago=0, pendente=100
      expect(result.dashPending).toBe(100);
      expect(result.dashExpected).toBe(100);
      expect(result.dashPaid).toBe(0);
    });

    it('não avança se há pendência no mês', () => {
      const loan = makeLoan({
        date: '2025-01-15',
        amount: 1000,
        interestRate: 10,
        payments: [makePayment(50, '2025-03-05')], // paga só metade
      });
      const clients = [makeClient([loan])];
      const result = calculateGlobalStats(clients, [], TIME_INFO);

      expect(result.dashPending).toBe(50); // 100 esperado - 50 pago
      expect(result.dashExpected).toBe(100);
      expect(result.dashPaid).toBe(50);
    });
  });

  // ==================== MÚLTIPLOS CLIENTES ====================

  describe('múltiplos clientes', () => {
    it('agrega pendências de todos os clientes', () => {
      const loan1 = makeLoan({
        id: 'l1', date: '2025-01-10', amount: 1000, interestRate: 10,
      });
      const loan2 = makeLoan({
        id: 'l2', date: '2025-02-10', amount: 2000, interestRate: 5,
      });
      const clients = [
        makeClient([loan1], { id: 'c1', name: 'Ana' }),
        makeClient([loan2], { id: 'c2', name: 'Bruno' }),
      ];
      const result = calculateGlobalStats(clients, [], TIME_INFO);

      // Ana: juros = 100 (10% de 1000)
      // Bruno: juros = 100 (5% de 2000)
      expect(result.dashExpected).toBe(200);
      expect(result.dashPending).toBe(200);
      expect(result.totalLent).toBe(3000);
      expect(result.processedClients).toHaveLength(2);
    });

    it('dinheiro disponível considera todos os empréstimos', () => {
      const funds = [{ id: 'f1', date: '2025-01-01', amount: 10000 }];
      const clients = [
        makeClient([makeLoan({ id: 'l1', amount: 3000 })], { id: 'c1' }),
        makeClient([makeLoan({ id: 'l2', amount: 2000 })], { id: 'c2' }),
      ];
      const result = calculateGlobalStats(clients, funds, TIME_INFO);

      expect(result.availableMoney).toBe(5000); // 10000 - 3000 - 2000
    });
  });

  // ==================== LOANS ORDENADOS POR DATA ====================

  describe('ordenação de contratos', () => {
    it('contratos são ordenados por data decrescente (mais recente primeiro)', () => {
      const loans = [
        makeLoan({ id: 'old', date: '2024-06-01' }),
        makeLoan({ id: 'new', date: '2025-02-01' }),
        makeLoan({ id: 'mid', date: '2024-12-01' }),
      ];
      const clients = [makeClient(loans)];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const ids = result.processedClients[0].loans.map((l) => l.id);

      expect(ids).toEqual(['new', 'mid', 'old']);
    });
  });

  // ==================== CLIENTE SEM CAMPO LOANS ====================

  describe('resiliência de dados', () => {
    it('cliente sem campo loans trata como array vazio', () => {
      const clients = [{ id: 'c1', name: 'Sem loans' }];
      const result = calculateGlobalStats(clients, [], TIME_INFO);
      const pc = result.processedClients[0];

      expect(pc.currentDebt).toBe(0);
      expect(pc.loans).toHaveLength(0);
    });
  });
});
