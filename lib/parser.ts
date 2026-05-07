import type { ParsedProduction, ShiftType } from './types'

/**
 * Parses a WhatsApp message from an MCM operator into structured production data.
 *
 * Expected message formats (flexible, operators may vary):
 *   "MCH-01 Day P001 50pkts 100cups"
 *   "mch-02 night p003 30 packets 50 cups sandip"
 *   "Machine 3 day shift product P005 packets 40 cups per packet 65"
 */
export function parseProductionMessage(text: string): ParsedProduction {
  const t = text.toUpperCase().trim()

  // Machine code: MCH-01 through MCH-09
  const machineMatch = t.match(/MCH[-\s]?(\d{1,2})/)
  const machine_code = machineMatch ? `MCH-0${machineMatch[1].padStart(1, '0')}` : null

  // Product code: P001–P020
  const productMatch = t.match(/P(\d{3})/)
  const product_code = productMatch ? `P${productMatch[1]}` : null

  // Shift
  let shift: ShiftType | null = null
  if (t.includes('NIGHT')) shift = 'Night'
  else if (t.includes('DAY')) shift = 'Day'

  // Packets quantity: "50pkts", "50 packets", "50pkt"
  const packetsMatch = t.match(/(\d+)\s*(?:PKTS?|PACKETS?)/)
  const packets_qty = packetsMatch ? parseInt(packetsMatch[1]) : null

  // Cups per packet: "100cups", "100 cups", "cups 100"
  const cupsMatch = t.match(/(\d+)\s*(?:CUPS?|CUP\s*PER)|(?:CUPS?\s*(?:PER\s*PACKET\s*)?[:=]?\s*)(\d+)/)
  const cups_per_packet = cupsMatch ? parseInt(cupsMatch[1] ?? cupsMatch[2]) : null

  // Operator code: OPR-01
  const operatorMatch = t.match(/OPR[-\s]?(\d{1,2})/)
  const operator_code = operatorMatch ? `OPR-${operatorMatch[1].padStart(2, '0')}` : null

  // Confidence: high if we got the 3 core fields
  const confidence = machine_code && product_code && packets_qty ? 'high' : 'low'

  return {
    machine_code,
    product_code,
    shift,
    packets_qty,
    cups_per_packet,
    operator_code,
    confidence,
  }
}

/**
 * Classify a message at a high level before detailed parsing.
 */
export function classifyMessage(text: string): 'PRODUCTION' | 'DOWNTIME' | 'QUALITY' | 'UNKNOWN' {
  const t = text.toLowerCase()

  if (
    t.includes('pkt') || t.includes('packet') || t.includes('cup') ||
    t.includes('produced') || t.includes('completed') || t.match(/p\d{3}/)
  ) return 'PRODUCTION'

  if (
    t.includes('down') || t.includes('stop') || t.includes('breakdown') ||
    t.includes('idle') || t.includes('band') || t.includes('repair')
  ) return 'DOWNTIME'

  if (
    t.includes('defect') || t.includes('reject') || t.includes('scrap') ||
    t.includes('rework') || t.includes('waste')
  ) return 'QUALITY'

  return 'UNKNOWN'
}
