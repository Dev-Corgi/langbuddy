import Image from "next/image";
import { MainNav } from "./_components/main-nav";
import { PostingCarousel } from "./_components/posting-carousel";
import { PostingList } from "./_components/posting-list";
import { LangBuddyNews } from "./_components/langbuddy-news";

export default function Home() {
  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-[40%] -right-[10%] w-[35%] h-[35%] bg-primary/3 rounded-full blur-[100px] animate-blob [animation-delay:2s]" />
        <div className="absolute bottom-[10%] -left-[5%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[110px] animate-blob [animation-delay:4s]" />
      </div>

      <MainNav activePrimaryLabel="Home" />
      <main className="py-6 md:py-10 relative z-10">
        <div className="mx-auto w-full max-w-[1600px] px-4 xl:px-8 space-y-20 md:space-y-32">
          <PostingCarousel />
          
          <div className="mx-auto w-full px-0 xl:px-32">
            <PostingList />
          </div>
          
          <section className="relative px-0 xl:px-32">
            <div className="absolute -inset-x-4 md:-inset-x-20 -inset-y-10 bg-muted/30 rounded-[60px] -z-10" />
            <LangBuddyNews />
          </section>
        </div>
      </main>
    </div>
  );
}
