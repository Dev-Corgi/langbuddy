import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type Props = {
  title: string
  greeting: string
  displayName: string
}

export function MyPageHeader({ title, greeting, displayName }: Props) {
  const initial = displayName ? displayName.trim().slice(0, 1).toUpperCase() : '?'

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <Avatar className="h-14 w-14 border border-border">
          <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
          <CardDescription className="text-base font-medium leading-snug">
            {greeting}
            {displayName ? (
              <>
                , <span className="text-foreground font-semibold">{displayName}</span>
              </>
            ) : null}
            !
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}
