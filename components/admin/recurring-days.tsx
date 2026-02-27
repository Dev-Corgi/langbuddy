'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface RecurringDaysProps {
  recurringDays: string[]
  onDayToggle: (day: string) => void
}

const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일']

export function RecurringDays({ recurringDays, onDayToggle }: RecurringDaysProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {ALL_DAYS.map(day => {
        const isActive = recurringDays.includes(day)
        return (
          <Button
            key={day}
            type="button"
            variant="outline"
            onClick={() => onDayToggle(day)}
            className={cn(
              'font-bold h-12 rounded-xl text-sm transition-all active:scale-90',
              isActive
                ? 'bg-primary text-primary-foreground border-primary shadow-lg hover:bg-primary/90'
                : 'bg-card text-muted-foreground border-border hover:bg-accent hover:border-border'
            )}
          >
            {day}
          </Button>
        )
      })}
    </div>
  )
}
