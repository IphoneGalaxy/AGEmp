/**
 * Funções de formatação de dados para exibição.
 */

/**
 * Formata um número como moeda brasileira (BRL).
 * @param {number} value - Valor numérico a ser formatado.
 * @returns {string} Valor formatado como moeda (ex: "R$ 1.234,56").
 */
export const formatMoney = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/**
 * Converte uma data no formato "YYYY-MM-DD" para "DD/MM/YYYY".
 * @param {string} dateStr - Data no formato ISO (YYYY-MM-DD).
 * @returns {string} Data formatada (DD/MM/YYYY) ou string vazia se inválida.
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Capitaliza a primeira letra de uma string.
 * @param {string} s - String a ser capitalizada.
 * @returns {string} String com a primeira letra em maiúscula.
 */
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Formata uma taxa de juros com separador decimal brasileiro.
 * @param {number} rate - Taxa em percentual (ex: 10, 8.5, 12.75).
 * @returns {string} Taxa formatada (ex: "10%", "8,5%", "12,75%").
 */
export const formatRate = (rate) =>
  rate.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';

/**
 * Formata um timestamp ISO para exibição humana em pt-BR.
 * @param {string} isoStr - Timestamp ISO (ex: "2025-04-05T14:30:00.000Z").
 * @returns {string} Data e hora formatadas (ex: "05/04/2025 às 14:30").
 */
export const formatDateTime = (isoStr) => {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const date = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} às ${time}`;
};
