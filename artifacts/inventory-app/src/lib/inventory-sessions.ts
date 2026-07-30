const SESSION_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function gerarCodigoSala() {
  const values = new Uint32Array(4)
  crypto.getRandomValues(values)

  const code = Array.from(values, (value) => SESSION_CODE_CHARS[value % SESSION_CODE_CHARS.length]).join('')
  return `ATV-${code}`
}