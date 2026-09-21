import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;

export const isPasswordStrongEnough = (password: string): boolean =>
  password.length >= MIN_PASSWORD_LENGTH;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, SALT_ROUNDS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);
