import { MainNav } from '@/app/_components/main-nav'
import { MainCarousel } from '@/app/_components/main-carousel'
import { PostingCarousel } from '@/app/_components/posting-carousel'
import { PostingList } from '@/app/_components/posting-list'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { MOCK_ALL_POSTINGS, MOCK_MEETUP_POSTINGS } from '@/lib/debug/mock-data'

export default function DebugHomePage() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[40%] -right-[10%] w-[35%] h-[35%] bg-primary/3 rounded-full blur-[100px] animate-blob [animation-delay:2s]" />
        <div className="absolute bottom-[10%] -left-[5%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[110px] animate-blob [animation-delay:4s]" />
      </div>

      <MainNav activePrimaryLabel="Home" />
      <main className="pt-5 pb-5 md:pt-0 md:pb-10 relative z-10">
        <MainCarousel postings={[...MOCK_ALL_POSTINGS]} hrefBase={DEBUG_BASE_PATH} />

        <div className="mx-auto w-full max-w-[1600px] space-y-10 pb-5 md:space-y-32">
          <div className="px-4 xl:px-40 bg-muted/30 py-15">
            <PostingCarousel initialItems={[...MOCK_MEETUP_POSTINGS]} hrefBase={DEBUG_BASE_PATH} />
          </div>

          <div className="mx-auto w-full px-4 xl:px-40">
            <PostingList initialItems={[...MOCK_MEETUP_POSTINGS]} hrefBase={DEBUG_BASE_PATH} />
          </div>
        </div>
      </main>
    </div>
  )
}
