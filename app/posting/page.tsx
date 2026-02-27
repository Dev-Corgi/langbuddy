import { MainNav } from "../_components/main-nav";
import { PostingCarousel } from "../_components/posting-carousel";
import { PostingList } from "../_components/posting-list";

export default function PostingPage() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <MainNav activePrimaryLabel="Social / Meetup" />
      <main className="py-10 md:py-20">
        <div className="mx-auto w-full max-w-[1600px] px-4 xl:px-8 space-y-20 md:space-y-32">
          <PostingCarousel />
          <PostingList />
        </div>
      </main>
    </div>
  );
}
