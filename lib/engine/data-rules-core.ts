import type { DataRuleDefinition } from '@/types/metadata'

type TokenType = 'identifier' | 'field' | 'string' | 'number' | 'bool' | 'null' | 'operator' | 'paren' | 'comma' | 'eof'
type Token = { type: TokenType; value: string }
type Node =
  | { kind: 'literal'; value: any }
  | { kind: 'field'; key: string }
  | { kind: 'unary'; op: string; expr: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '{') {
      const end = input.indexOf('}', i + 1)
      if (end < 0) throw new Error('Unclosed field reference')
      tokens.push({ type: 'field', value: input.slice(i + 1, end).trim() })
      i = end + 1
      continue
    }
    if (c === '"') {
      let j = i + 1
      let value = ''
      while (j < input.length) {
        if (input[j] === '"' && input[j - 1] !== '\\') break
        value += input[j]
        j++
      }
      if (j >= input.length) throw new Error('Unclosed string')
      tokens.push({ type: 'string', value: value.replace(/\\"/g, '"') })
      i = j + 1
      continue
    }
    const two = input.slice(i, i + 2)
    if (['==', '!=', '>=', '<='].includes(two)) {
      tokens.push({ type: 'operator', value: two })
      i += 2
      continue
    }
    if (['>', '<'].includes(c)) {
      tokens.push({ type: 'operator', value: c })
      i++
      continue
    }
    if (c === '(' || c === ')') {
      tokens.push({ type: 'paren', value: c })
      i++
      continue
    }
    if (c === ',') {
      tokens.push({ type: 'comma', value: c })
      i++
      continue
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1
      while (j < input.length && /[0-9.]/.test(input[j])) j++
      tokens.push({ type: 'number', value: input.slice(i, j) })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++
      const raw = input.slice(i, j)
      const up = raw.toUpperCase()
      if (up === 'AND' || up === 'OR' || up === 'NOT') tokens.push({ type: 'operator', value: up })
      else if (up === 'TRUE' || up === 'FALSE') tokens.push({ type: 'bool', value: up.toLowerCase() })
      else if (up === 'NULL') tokens.push({ type: 'null', value: 'null' })
      else tokens.push({ type: 'identifier', value: raw })
      i = j
      continue
    }
    throw new Error(`Unexpected character: ${c}`)
  }
  tokens.push({ type: 'eof', value: '' })
  return tokens
}

class Parser {
  private idx = 0
  constructor(private readonly tokens: Token[]) {}
  private current() { return this.tokens[this.idx] }
  private consume() { return this.tokens[this.idx++] }
  private expect(type: TokenType, value?: string) {
    const t = this.current()
    if (t.type !== type || (value && t.value !== value)) throw new Error(`Expected ${type} ${value ?? ''}`)
    return this.consume()
  }
  parse(): Node { return this.parseOr() }
  private parseOr(): Node {
    let node = this.parseAnd()
    while (this.current().type === 'operator' && this.current().value === 'OR') node = { kind: 'binary', op: 'OR', left: node, right: (this.consume(), this.parseAnd()) }
    return node
  }
  private parseAnd(): Node {
    let node = this.parseNot()
    while (this.current().type === 'operator' && this.current().value === 'AND') node = { kind: 'binary', op: 'AND', left: node, right: (this.consume(), this.parseNot()) }
    return node
  }
  private parseNot(): Node {
    if (this.current().type === 'operator' && this.current().value === 'NOT') return { kind: 'unary', op: 'NOT', expr: (this.consume(), this.parseNot()) }
    return this.parseComparison()
  }
  private parseComparison(): Node {
    let node = this.parsePrimary()
    while (this.current().type === 'operator' && ['==', '!=', '>', '<', '>=', '<='].includes(this.current().value)) {
      const op = this.consume().value
      node = { kind: 'binary', op, left: node, right: this.parsePrimary() }
    }
    return node
  }
  private parsePrimary(): Node {
    const t = this.current()
    if (t.type === 'paren' && t.value === '(') {
      this.consume()
      const node = this.parseOr()
      this.expect('paren', ')')
      return node
    }
    if (t.type === 'field') return { kind: 'field', key: this.consume().value }
    if (t.type === 'string') return { kind: 'literal', value: this.consume().value }
    if (t.type === 'number') return { kind: 'literal', value: Number(this.consume().value) }
    if (t.type === 'bool') return { kind: 'literal', value: this.consume().value === 'true' }
    if (t.type === 'null') return { kind: 'literal', value: null }
    if (t.type === 'identifier') {
      const name = this.consume().value.toUpperCase()
      if (this.current().type === 'paren' && this.current().value === '(') {
        this.consume()
        const args: Node[] = []
        if (!(this.current().type === 'paren' && this.current().value === ')')) {
          args.push(this.parseOr())
          while (this.current().type === 'comma') {
            this.consume()
            args.push(this.parseOr())
          }
        }
        this.expect('paren', ')')
        return { kind: 'call', name, args }
      }
      return { kind: 'literal', value: name }
    }
    throw new Error('Unexpected token')
  }
}

function isBlank(value: any) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

function evaluateCall(name: string, args: any[]) {
  switch (name) {
    case 'IS_BLANK': return isBlank(args[0])
    case 'IS_NOT_BLANK': return !isBlank(args[0])
    case 'CONTAINS': return String(args[0] ?? '').includes(String(args[1] ?? ''))
    case 'STARTS_WITH': return String(args[0] ?? '').startsWith(String(args[1] ?? ''))
    case 'INCLUDES': {
      const left = args[0]
      const right = String(args[1] ?? '')
      if (Array.isArray(left)) return left.map(String).includes(right)
      return String(left ?? '').split(',').map((x) => x.trim()).includes(right)
    }
    case 'LEN': return String(args[0] ?? '').length
    case 'TODAY': {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'NOW': return new Date()
    case 'DATE_DIFF': {
      const a = new Date(args[0])
      const b = new Date(args[1])
      const unit = String(args[2] ?? 'days').toLowerCase()
      const diffMs = a.getTime() - b.getTime()
      if (unit === 'days') return Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (unit === 'hours') return Math.floor(diffMs / (1000 * 60 * 60))
      return diffMs
    }
    default: throw new Error(`Unsupported function: ${name}`)
  }
}

function compare(left: any, op: string, right: any) {
  if (left instanceof Date || right instanceof Date) {
    const l = left instanceof Date ? left.getTime() : new Date(left).getTime()
    const r = right instanceof Date ? right.getTime() : new Date(right).getTime()
    if (op === '==') return l === r
    if (op === '!=') return l !== r
    if (op === '>') return l > r
    if (op === '<') return l < r
    if (op === '>=') return l >= r
    if (op === '<=') return l <= r
  }
  if (op === '==') return left === right
  if (op === '!=') return left !== right
  if (op === '>') return Number(left) > Number(right)
  if (op === '<') return Number(left) < Number(right)
  if (op === '>=') return Number(left) >= Number(right)
  if (op === '<=') return Number(left) <= Number(right)
  return false
}

function evaluate(node: Node, data: Record<string, any>): any {
  if (node.kind === 'literal') return node.value
  if (node.kind === 'field') return data[node.key]
  if (node.kind === 'unary') return !Boolean(evaluate(node.expr, data))
  if (node.kind === 'binary') {
    if (node.op === 'AND') return Boolean(evaluate(node.left, data)) && Boolean(evaluate(node.right, data))
    if (node.op === 'OR') return Boolean(evaluate(node.left, data)) || Boolean(evaluate(node.right, data))
    return compare(evaluate(node.left, data), node.op, evaluate(node.right, data))
  }
  return evaluateCall(node.name, node.args.map((a) => evaluate(a, data)))
}

export function evaluateRuleCondition(conditionFormula: string, recordData: Record<string, any>) {
  const parser = new Parser(tokenize(conditionFormula))
  const ast = parser.parse()
  return Boolean(evaluate(ast, recordData))
}

export type ValidationError = { field_key: string | null; message: string; rule_key: string }
export type ValidationResult = { valid: boolean; errors: ValidationError[] }

export function runRules(rules: DataRuleDefinition[], recordData: Record<string, any>, operation: 'insert' | 'update'): ValidationResult {
  const errors: ValidationError[] = []
  for (const rule of rules) {
    if (!rule.is_active) continue
    const triggers = rule.trigger_on ?? ['insert', 'update']
    if (!triggers.includes(operation)) continue
    try {
      const fires = evaluateRuleCondition(rule.condition_formula, recordData)
      if (fires) errors.push({ field_key: rule.error_field_key, message: rule.error_message, rule_key: rule.rule_key })
    } catch {
      errors.push({ field_key: rule.error_field_key ?? null, message: `Rule evaluation failed: ${rule.rule_name}`, rule_key: rule.rule_key })
    }
  }
  return { valid: errors.length === 0, errors }
}

export function parseDataRuleViolationError(errorText: string): ValidationError | null {
  const match = /DATA_RULE_VIOLATION:\s*(.*?)\s*\|\s*FIELD:\s*(.*?)\s*\|\s*RULE:\s*(.*)$/i.exec(errorText)
  if (!match) return null
  return {
    message: match[1]?.trim() || 'Validation failed',
    field_key: match[2]?.trim() === 'record' ? null : match[2]?.trim() || null,
    rule_key: match[3]?.trim() || 'unknown_rule',
  }
}
