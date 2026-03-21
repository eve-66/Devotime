import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export function validateCredentials(name: string, password: string) {
  if (name.trim().length < 2) {
    throw new Error("ユーザー名は2文字以上で入力してください。");
  }

  if (password.length < 4) {
    throw new Error("パスワードは4文字以上で入力してください。");
  }
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 64).toString("hex");

  return {
    salt,
    passwordHash,
  };
}

export function verifyPassword(password: string, salt: string, passwordHash: string) {
  const actualBuffer = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "hex");
  const expectedBuffer = Buffer.from(passwordHash, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
