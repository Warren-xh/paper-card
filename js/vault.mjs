// Password vault: the GitHub token is encrypted in the browser with a key
// derived from the owner's password (PBKDF2 → AES-256-GCM). Only the
// encrypted vault is stored in the public repository.

const ITERATIONS = 600000;
const TOKEN_PATTERN = /^github_pat_[A-Za-z0-9_]{20,}$/;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toBase64 = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const aad = (repo) => enc.encode("paper-cards/vault/v1/" + repo.toLowerCase());

export function validToken(token) {
  return typeof token === "string" && TOKEN_PATTERN.test(token.trim());
}

// Returns an error message, or "" when the password is acceptable.
export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8)
    return "密码至少需要 8 位。";
  if (password.length > 200) return "密码太长了。";
  if (/^\d+$/.test(password)) return "不要只用数字，加几个字母吧。";
  if (new Set(password).size < 5) return "密码里重复的字符太多了。";
  const common = ["password", "12345678", "qwertyui", "iloveyou", "abcdefgh"];
  if (common.some((word) => password.toLowerCase().includes(word)))
    return "这个密码太常见了，换一个吧。";
  return "";
}

async function deriveKey(password, salt, iterations, usage) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function sealToken(token, password, repo) {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if (!validToken(token))
    throw new Error("令牌格式不对：请使用 github_pat_ 开头的细粒度令牌。");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS, "encrypt");
  const plaintext = enc.encode(JSON.stringify({ token: token.trim(), repo }));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad(repo), tagLength: 128 },
      key,
      plaintext,
    );
    return {
      version: 1,
      repo,
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: ITERATIONS,
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      updatedAt: new Date().toISOString(),
    };
  } finally {
    plaintext.fill(0);
  }
}

export function validVault(vault) {
  return (
    !!vault &&
    vault.version === 1 &&
    vault.algorithm === "AES-256-GCM" &&
    vault.kdf === "PBKDF2-SHA256" &&
    Number.isInteger(vault.iterations) &&
    vault.iterations >= ITERATIONS &&
    vault.iterations <= 3000000 &&
    typeof vault.salt === "string" &&
    typeof vault.iv === "string" &&
    typeof vault.ciphertext === "string" &&
    vault.ciphertext.length < 10000
  );
}

export async function openVault(vault, password, repo) {
  if (!validVault(vault)) throw new Error("授权文件已损坏，请到设置页重新配置。");
  let bytes;
  try {
    const key = await deriveKey(
      password,
      fromBase64(vault.salt),
      vault.iterations,
      "decrypt",
    );
    bytes = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(vault.iv),
          additionalData: aad(repo),
          tagLength: 128,
        },
        key,
        fromBase64(vault.ciphertext),
      ),
    );
    const payload = JSON.parse(dec.decode(bytes));
    if (!validToken(payload.token)) throw new Error();
    return payload.token;
  } catch {
    throw new Error("密码不正确。");
  } finally {
    bytes?.fill(0);
  }
}
