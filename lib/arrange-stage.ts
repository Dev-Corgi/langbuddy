/**
 * 자리배치 화면: 라운드별 assignments 유무로 운영 단계를 나눔.
 * - 1: 아무 라운드도 배정 없음 → QR/수동은 미배정만
 * - 2: R1만 있음 → 늦참은 R1에만 즉시 배치
 * - 3: R1+R2 → 늦참은 R2에만
 * - 4: 세 라운드 모두 → 늦참은 R3에만
 * (이후 라운드 자동 배치 시 arrangeRound는 전체 participants 풀을 쓰므로 늦참도 포함됨)
 */
export type ArrangeRoundSnapshot = {
  round: number
  assignments: { participant_id: string; table_label: string }[]
}

export type ArrangeStage = 1 | 2 | 3 | 4

export function deriveArrangeStage(rounds: ArrangeRoundSnapshot[]): ArrangeStage {
  const has = (n: number) => (rounds.find((r) => r.round === n)?.assignments?.length ?? 0) > 0
  const r1 = has(1)
  const r2 = has(2)
  const r3 = has(3)
  if (!r1 && !r2 && !r3) return 1
  if (r1 && !r2 && !r3) return 2
  if (r1 && r2 && !r3) return 3
  return 4
}

/** stage 1 → 배치 안 함(null). 그 외 → 즉시 넣을 라운드 번호 */
export function targetRoundForLateJoin(stage: ArrangeStage): number | null {
  if (stage === 1) return null
  if (stage === 2) return 1
  if (stage === 3) return 2
  return 3
}

/**
 * QR/현장 안내용: DB에 저장된 배치 단계만 보고 “지금 참가자에게 보여줄 좌석 라운드”.
 * 자리배치 프로그램이 돌린 결과(snapshots)와 동일한 deriveArrangeStage를 쓴 뒤 매핑만 함.
 * stage 1 → 아직 아무 라운드도 배정 없음 → UI에서 "미정".
 */
export function displayRoundForQr(stage: ArrangeStage): number | null {
  if (stage === 1) return null
  return stage - 1
}
