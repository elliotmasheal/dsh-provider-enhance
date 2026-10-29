/**
 * Line-oriented helpers for the `accounts` blocks this plugin writes into a DSH
 * profile's `cordis.patch.yml`.
 *
 * The file is user-authored YAML, so the helpers never re-serialize it: they
 * only find an `accounts` key and the deeper-indented lines that belong to it.
 * That keeps comments, ordering and formatting of everything else untouched.
 * @module scripts/lib/accounts
 */

/** An `accounts:` key with an optional inline value (`[]`). */
const ACCOUNTS = /^(\s*)accounts:\s*(\[\s*\])?\s*(?:#.*)?$/

/** One account entry's `name` (nested model entries start with `- id:`). */
const ACCOUNT_NAME = /^\s*-\s+name:\s*(.*?)\s*(?:#.*)?$/

/**
 * Remove every `accounts` block from the patch text.
 * A block ends at the first non-blank line indented no deeper than its key.
 * @param {string} text - the profile patch file.
 * @returns {{ text: string, removed: number }} the rewritten text and how many
 * blocks were removed.
 */
export function stripAccounts(text) {
  const lines = text.split('\n')
  const kept = []
  let removed = 0
  for (let index = 0; index < lines.length; index += 1) {
    const match = ACCOUNTS.exec(lines[index])
    if (match === null) {
      kept.push(lines[index])
      continue
    }
    const indent = match[1].length
    removed += 1
    let end = index + 1
    while (end < lines.length) {
      const line = lines[end]
      if (line.trim() === '') {
        end += 1
        continue
      }
      const lineIndent = line.length - line.trimStart().length
      if (lineIndent <= indent) break
      end += 1
    }
    index = end - 1
  }
  return { text: kept.join('\n'), removed }
}

/**
 * Collect configuration names from every `accounts` block, in file order.
 * @param {string} text - the profile patch file.
 * @returns {string[]} trimmed configuration names.
 */
export function accountNames(text) {
  const names = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = ACCOUNTS.exec(lines[index])
    if (match === null) continue
    const indent = match[1].length
    let end = index + 1
    while (end < lines.length) {
      const line = lines[end]
      if (line.trim() === '') {
        end += 1
        continue
      }
      const lineIndent = line.length - line.trimStart().length
      if (lineIndent <= indent) break
      const name = ACCOUNT_NAME.exec(line)
      if (name !== null && name[1] !== '') names.push(name[1])
      end += 1
    }
    index = end - 1
  }
  return names
}

/**
 * Configuration names that appear more than once (they must be unique inside a
 * provider, and the UI writes them per provider only, so a duplicate is always
 * a configuration error this plugin should have rejected).
 * @param {string} text - the profile patch file.
 * @returns {string[]} duplicated names, sorted.
 */
export function duplicateAccountNames(text) {
  const seen = new Set()
  const duplicate = new Set()
  for (const name of accountNames(text)) {
    if (seen.has(name)) duplicate.add(name)
    else seen.add(name)
  }
  return [...duplicate].sort()
}
