import { MainNav } from '@/app/_components/main-nav'
import { PostingCarousel } from '@/app/_components/posting-carousel'
import { PostingList } from '@/app/_components/posting-list'
import { DEBUG_BASE_PATH } from '@/lib/debug/debug-base-path'
import { MOCK_MEETUP_POSTINGS } from '@/lib/debug/mock-data'

export default function DebugPostingListPage() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <MainNav activePrimaryLabel="Social / Meetup" />
      <main className="py-10 md:py-20">
        <div className="mx-auto w-full max-w-[1600px] px-4 xl:px-8 space-y-20 md:space-y-32">
          <PostingCarousel initialItems={[...MOCK_MEETUP_POSTINGS]} hrefBase={DEBUG_BASE_PATH} />
          <PostingList initialItems={[...MOCK_MEETUP_POSTINGS]} hrefBase={DEBUG_BASE_PATH} />
        </div>
      </main>
    </div>
  )
}
