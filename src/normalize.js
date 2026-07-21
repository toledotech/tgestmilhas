/**
 * Formato normalizado de um voo, comum a todos os programas.
 * @typedef {Object} Flight
 * @property {string} program
 * @property {string} origin
 * @property {string} destination
 * @property {string} date
 * @property {number} miles
 * @property {number} taxes
 * @property {string|null} flightNumber
 * @property {string|null} link
 */

function normalizeFlight({ program, origin, destination, date, miles, taxes, flightNumber = null, link = null }) {
  return {
    program,
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    date,
    miles: Number(miles),
    taxes: Number(taxes),
    flightNumber,
    link,
  };
}

module.exports = { normalizeFlight };
