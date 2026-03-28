const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I to avoid confusion

export function generateReferralCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}
