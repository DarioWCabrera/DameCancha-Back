export type AuthenticatedUser = {
  sub: number;
  email: string;
  tipo: 'usuario' | 'club' | 'dueno' | 'admin';
  role?: string;
  iat?: number;
  exp?: number;
};
