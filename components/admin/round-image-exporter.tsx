'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import type { RoundData } from '@/lib/seating-algorithm'
import { sortTableLabels } from '@/lib/seating-table-ops'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type RoundImageParticipant = {
  id: string
  name: string
  gender: string
  nationality: string
  language: string
}

interface RoundImageExporterProps {
  round: number
  roundData: RoundData
  participants: RoundImageParticipant[]
}

export function RoundImageExporter({ round, roundData, participants }: RoundImageExporterProps) {
  const exportRef = useRef<HTMLDivElement>(null)

  const handleExportImage = async () => {
    if (!exportRef.current) return

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })

      const link = document.createElement('a')
      link.download = `${round}라운드_배치결과.png`
      link.href = dataUrl
      link.click()

      toast.success(`${round}라운드 배치 결과를 이미지로 저장했습니다.`)
    } catch (error) {
      console.error('Failed to export image:', error)
      toast.error('이미지 내보내기에 실패했습니다.')
    }
  }

  // 이미지 내보내기는 관리자 커스텀 순서와 무관하게 라벨 알파벳 순
  const tableLabels = sortTableLabels(Object.keys(roundData.tableLanguages || {}))

  return (
    <>
      <Button
        type="button"
        onClick={handleExportImage}
        variant="outline"
        className="rounded-xl font-bold gap-2"
        disabled={roundData.assignments.length === 0}
      >
        <Download className="w-4 h-4" />
        이미지로 내보내기
      </Button>

      <div className="fixed -left-[9999px] -top-[9999px]" aria-hidden>
        <div ref={exportRef} className="bg-white p-8" style={{ width: '1200px' }}>
          <div className="mb-6">
            <h1 className="text-3xl font-black mb-2">{round} Round 배치 결과</h1>
            <p className="text-muted-foreground font-medium">총 {participants.length}명의 참가자</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {tableLabels.map((label) => {
              const tableParticipants = roundData.assignments
                .filter((a) => a.table_label === label)
                .map((a) => participants.find((p) => p.id === a.participant_id))
                .filter(Boolean) as RoundImageParticipant[]

              const tableLanguage =
                roundData.tableLanguages?.[label] ||
                (tableParticipants.length > 0 ? tableParticipants[0].language : '')

              return (
                <Card key={label} className="border shadow-md rounded-3xl overflow-hidden">
                  <CardHeader className="p-4 bg-gray-50 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-black">{label} Table</CardTitle>
                        {tableLanguage ? (
                          <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-1 rounded flex items-center gap-1">
                            {tableLanguage === '영어' ? (
                              <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                                <rect width="20" height="14" fill="#B22234" />
                                <rect y="1.08" width="20" height="1.08" fill="white" />
                                <rect y="3.23" width="20" height="1.08" fill="white" />
                                <rect y="5.38" width="20" height="1.08" fill="white" />
                                <rect y="7.54" width="20" height="1.08" fill="white" />
                                <rect y="9.69" width="20" height="1.08" fill="white" />
                                <rect y="11.85" width="20" height="1.08" fill="white" />
                                <rect width="8" height="7.54" fill="#3C3B6E" />
                              </svg>
                            ) : tableLanguage === '일본어' ? (
                              <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                                <rect width="20" height="14" fill="white" />
                                <circle cx="10" cy="7" r="3.5" fill="#BC002D" />
                              </svg>
                            ) : null}
                            {tableLanguage}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs font-bold text-gray-500">{tableParticipants.length}명</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {tableParticipants.map((p) => {
                        const isForeigner = p.nationality === '외국인'
                        const isFemale = p.gender === '여'
                        return (
                          <div
                            key={p.id}
                            className={`flex flex-col p-2 rounded-lg border shadow-sm overflow-hidden relative ${
                              isForeigner ? 'bg-blue-50/40' : 'bg-emerald-50/40'
                            }`}
                          >
                            <div
                              className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                isForeigner ? 'bg-blue-500' : 'bg-emerald-500'
                              }`}
                            />
                            <div className="pl-2">
                              <p className="font-bold text-sm truncate mb-1">{p.name}</p>
                              <div className="flex gap-1 flex-wrap">
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                    isForeigner ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {p.nationality}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                    isFemale ? 'bg-pink-100 text-pink-600' : 'bg-sky-100 text-sky-700'
                                  }`}
                                >
                                  {p.gender}
                                </span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-primary/10 text-primary flex items-center gap-0.5">
                                  {p.language === '영어' ? (
                                    <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                                      <rect width="20" height="14" fill="#B22234" />
                                      <rect y="1.08" width="20" height="1.08" fill="white" />
                                      <rect y="3.23" width="20" height="1.08" fill="white" />
                                      <rect y="5.38" width="20" height="1.08" fill="white" />
                                      <rect y="7.54" width="20" height="1.08" fill="white" />
                                      <rect y="9.69" width="20" height="1.08" fill="white" />
                                      <rect y="11.85" width="20" height="1.08" fill="white" />
                                      <rect width="8" height="7.54" fill="#3C3B6E" />
                                    </svg>
                                  ) : p.language === '일본어' ? (
                                    <svg className="w-3 h-3" viewBox="0 0 20 14" fill="none">
                                      <rect width="20" height="14" fill="white" />
                                      <circle cx="10" cy="7" r="3.5" fill="#BC002D" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10" />
                                      <path d="M2 12h20" />
                                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                  )}
                                  {p.language}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
