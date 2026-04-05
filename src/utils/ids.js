/**
 * Geração de identificadores únicos.
 */

/**
 * Gera um ID alfanumérico aleatório de 9 caracteres.
 * @returns {string} ID gerado (ex: "k3m8x1z9q").
 */
export const generateId = () => Math.random().toString(36).substr(2, 9);
