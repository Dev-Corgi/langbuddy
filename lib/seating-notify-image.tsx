import { ImageResponse } from 'next/og'

export type SeatingNotifyParticipant = {
  name: string
  nationality: string
  gender: string
  language: string
}

/**
 * next/og(Satori)는 WOFF2(시그니처 wOF2)를 지원하지 않음.
 * Google CSS가 기본으로 주는 woff2 대신 WOFF v1 또는 TTF를 쓴다.
 */
const NOTO_KR_WOFF_BASE =
  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.2.9/files'

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { next: { revalidate: 604800 } })
  if (!res.ok) throw new Error(`Font fetch failed ${res.status}: ${url}`)
  return res.arrayBuffer()
}

/** unicode 블록 0 — 한글·라틴 기본 글리프 (OG 이미지용으로 충분한 경우가 많음) */
async function loadNotoSansKrOggCompatible(weight: 400 | 700): Promise<ArrayBuffer> {
  const w = weight === 400 ? '400' : '700'
  const woffUrl = `${NOTO_KR_WOFF_BASE}/noto-sans-kr-0-${w}-normal.woff`
  return fetchArrayBuffer(woffUrl)
}

let fonts400: ArrayBuffer | null = null
let fonts700: ArrayBuffer | null = null

async function getFonts() {
  if (!fonts400) fonts400 = await loadNotoSansKrOggCompatible(400)
  if (!fonts700) fonts700 = await loadNotoSansKrOggCompatible(700)
  return { fonts400, fonts700 }
}

function natColor(nationality: string): string {
  return nationality === '외국인' ? '#1d4ed8' : '#047857'
}

function genderBadge(gender: string): { bg: string; fg: string } {
  return gender === '여' ? { bg: '#fce7f3', fg: '#be185d' } : { bg: '#e0f2fe', fg: '#0369a1' }
}

/** 단일 테이블 카드만 — RoundImageExporter와 동일 정보(한 테이블) */
export async function seatingSingleTableImageResponse(
  round: number,
  tableLabel: string,
  tableLanguage: string,
  participants: SeatingNotifyParticipant[]
) {
  const { fonts400, fonts700 } = await getFonts()
  const rowCount = Math.ceil(Math.max(participants.length, 1) / 2)
  const height = Math.min(980, 200 + rowCount * 148)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#ffffff',
          fontFamily: '"Noto Sans KR", sans-serif',
        }}
      >
        <div
          style={{
            height: 6,
            width: '100%',
            background: 'linear-gradient(90deg, #6366f1, #14b8a6)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', padding: 28, flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 3,
                color: '#6366f1',
                textTransform: 'uppercase',
              }}
            >
              LangBuddy
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>
                {round}라운드 · 테이블 {tableLabel}
              </span>
              {tableLanguage ? (
                <span
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#4f46e5',
                    background: 'rgba(99, 102, 241, 0.12)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    alignSelf: 'flex-start',
                  }}
                >
                  {tableLanguage}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>{participants.length}명</span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 20,
            }}
          >
            {participants.map((p, i) => {
              const isForeigner = p.nationality === '외국인'
              const g = genderBadge(p.gender)
              const cardBg = isForeigner ? '#eff6ff' : '#ecfdf5'
              const bar = isForeigner ? '#3b82f6' : '#10b981'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    width: '47%',
                    minHeight: 110,
                    background: cardBg,
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: 6, background: bar, flexShrink: 0 }} />
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '12px 14px',
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#111827',
                        marginBottom: 8,
                      }}
                    >
                      {p.name}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: isForeigner ? '#dbeafe' : '#d1fae5',
                          color: natColor(p.nationality),
                          padding: '4px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {p.nationality}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: g.bg,
                          color: g.fg,
                          padding: '4px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {p.gender}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#4338ca',
                          padding: '4px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {p.language}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 16,
              fontSize: 11,
              color: '#9ca3af',
              fontWeight: 600,
            }}
          >
            행사 현장에서 위 테이블로 이동해 주세요.
          </div>
        </div>
      </div>
    ),
    {
      width: 560,
      height,
      fonts: [
        { name: 'Noto Sans KR', data: fonts400, style: 'normal' as const, weight: 400 },
        { name: 'Noto Sans KR', data: fonts700, style: 'normal' as const, weight: 700 },
      ],
    }
  )
}

export async function buildSeatingTablePngBuffer(
  round: number,
  tableLabel: string,
  tableLanguage: string,
  participants: SeatingNotifyParticipant[]
): Promise<Buffer> {
  const res = await seatingSingleTableImageResponse(round, tableLabel, tableLanguage, participants)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/** 카카오 피드 image_width / image_height와 동기화 */
export function seatingNotifyImageDimensions(participantCount: number): { width: number; height: number } {
  const rowCount = Math.ceil(Math.max(participantCount, 1) / 2)
  const height = Math.min(980, 200 + rowCount * 148)
  return { width: 560, height }
}
