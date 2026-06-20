import {
  normalizeGender,
  normalizeLanguage,
  normalizeNationality,
} from '@/lib/form-answer-canonical'

export type WalkInCsvRow = {
  lineNum: number
  name: string
  gender: '남' | '여'
  nationality: '한국인' | '외국인'
  language: string
}

export type WalkInCsvParseResult = {
  rows: WalkInCsvRow[]
  errors: string[]
}

const HEADER_FIRST_CELL = /^(이름|name)$/i

function splitCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim())
}

function isHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return false
  return HEADER_FIRST_CELL.test(cells[0] ?? '')
}

export function parseWalkInCsvText(text: string): WalkInCsvParseResult {
  const rows: WalkInCsvRow[] = []
  const errors: string[] = []

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    errors.push('입력된 CSV 행이 없습니다.')
    return { rows, errors }
  }

  let lineOffset = 0
  const firstCells = splitCsvLine(lines[0]!)
  if (isHeaderRow(firstCells)) {
    lineOffset = 1
  }

  for (let i = lineOffset; i < lines.length; i++) {
    const lineNum = i + 1
    const cells = splitCsvLine(lines[i]!)

    if (cells.length < 4) {
      errors.push(`${lineNum}번째 줄: 열이 4개(이름,성별,국적,언어) 필요합니다.`)
      continue
    }

    const name = cells[0] ?? ''
    const genderRaw = cells[1] ?? ''
    const nationalityRaw = cells[2] ?? ''
    const languageRaw = cells[3] ?? ''

    if (!name) {
      errors.push(`${lineNum}번째 줄: 이름이 없습니다.`)
      continue
    }

    const gender = normalizeGender(genderRaw)
    if (gender !== '남' && gender !== '여') {
      errors.push(
        `${lineNum}번째 줄 (${name}): 성별이 올바르지 않습니다. "남자" 또는 "여자"로 입력하세요.`
      )
      continue
    }

    const nationality = normalizeNationality(nationalityRaw)
    if (nationality !== '한국인' && nationality !== '외국인') {
      errors.push(
        `${lineNum}번째 줄 (${name}): 국적이 올바르지 않습니다. "한국인" 또는 "Foreigner"로 입력하세요.`
      )
      continue
    }

    const language = normalizeLanguage(languageRaw)
    if (!language || language === '-') {
      errors.push(`${lineNum}번째 줄 (${name}): 언어가 없습니다.`)
      continue
    }

    rows.push({
      lineNum,
      name,
      gender,
      nationality,
      language,
    })
  }

  return { rows, errors }
}
