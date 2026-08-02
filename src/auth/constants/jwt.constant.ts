/**
 * @deprecated El secreto JWT se obtiene exclusivamente desde JWT_SECRET.
 * Este archivo se conserva para evitar romper imports históricos durante la migración.
 */
export const jwtConstants = {
  secret: process.env.JWT_SECRET || '',
};
