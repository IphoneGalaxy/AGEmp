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
