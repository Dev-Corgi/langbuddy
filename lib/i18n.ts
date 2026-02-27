export type Locale = 'ko' | 'en';

export const defaultLocale: Locale = 'ko';
export const locales: Locale[] = ['ko', 'en'];

export const i18n = {
  ko: {
    nav: {
      home: "홈",
      study: "스터디",
      language: "언어교환",
      social: "소모임 / 번개",
      login: "로그인",
      myBookings: "내 예약",
      category: "카테고리",
      search: "검색",
      my: "마이",
    },
    home: {
      hero: {
        title: "이제 LangBuddy로 떠나요!",
      },
      news: {
        title: "랭버디 뉴스",
        description: "다양한 소식과 영상을 만나보세요",
      },
      sections: {
        join: "동아리 활동 참여하기",
        joinDesc: "관심 있는 모임에 지금 바로 참여해보세요",
        recommendation: "이런 활동은 어때요?",
      }
    },
    posting: {
      carouselTitle: "오픈 예정 모임",
      listTitle: "전체 모임",
      noPostings: "등록된 포스팅이 없습니다.",
      loading: "데이터를 불러오는 중...",
    },
    booking: {
      title: "예매하기",
      apply: "지금 신청하기",
      share: "공유하기",
      info: "예매대기가 불가한 상품입니다.",
      select: "선택",
      notice: "모임 일정은 상황에 따라 변경될 수 있으며, 취소 시 사전 공지됩니다.",
      today: "오늘",
    },
    forms: {
      management: "폼 관리",
      create: "새 폼 만들기",
      edit: "신청 폼 수정",
      title: "제목",
      description: "설명",
      questions: "질문",
      responses: "응답 확인",
      required: "필수",
      submit: "제출하기",
      submitted: "신청이 완료되었습니다!",
      placeholderTitle: "폼 제목을 입력하세요",
      placeholderDesc: "폼에 대한 설명을 입력하세요",
      addQuestion: "질문 추가하기",
      save: "폼 저장하기",
      noForms: "생성된 폼이 없습니다.",
      loading: "폼을 불러오는 중...",
      deleteConfirm: "정말 삭제하시겠습니까?",
      externalTitle: "외부 신청 링크",
      externalDesc: "이 모임은 외부 신청 폼을 사용하고 있습니다. 아래 버튼을 클릭하여 신청을 계속해주세요.",
      goToApplication: "신청하러 가기",
    },
    common: {
      more: "더 보기",
      viewAll: "전체보기",
      location: "장소",
      date: "날짜",
      time: "시간",
      cost: "참가비",
      host: "주최",
      back: "뒤로가기",
      save: "저장하기",
      delete: "삭제하기",
      edit: "수정",
      status: "상태",
      category: "카테고리",
    }
  },
  en: {
    nav: {
      home: "Home",
      study: "Study",
      language: "Language",
      social: "Social / Meetup",
      login: "Login",
      myBookings: "My Bookings",
      category: "Category",
      search: "Search",
      my: "My",
    },
    home: {
      hero: {
        title: "Travel with LangBuddy now!",
      },
      news: {
        title: "LANGBUDDY NEWS",
        description: "Explore various news and videos from our club Instagram",
      },
      sections: {
        join: "Join Our Activities",
        joinDesc: "Join the meetings you're interested in right now",
        recommendation: "Recommended for You",
      }
    },
    posting: {
      carouselTitle: "Upcoming Meetups",
      listTitle: "All Meetups",
      noPostings: "No postings available.",
      loading: "Loading data...",
    },
    booking: {
      title: "Booking",
      apply: "Apply Now",
      share: "Share",
      info: "This item is not available for waiting list.",
      select: "Select",
      notice: "Schedule is subject to change. Cancellation will be notified in advance.",
      today: "TODAY",
    },
    forms: {
      management: "Form Management",
      create: "Create New Form",
      edit: "Edit Form",
      title: "Title",
      description: "Description",
      questions: "Questions",
      responses: "Responses",
      required: "Required",
      submit: "Submit",
      submitted: "Application Submitted!",
      placeholderTitle: "Enter form title",
      placeholderDesc: "Enter form description",
      addQuestion: "Add Question",
      save: "Save Form",
      noForms: "No forms created.",
      loading: "Loading forms...",
      deleteConfirm: "Are you sure you want to delete this form?",
      externalTitle: "External Application",
      externalDesc: "This event uses an external form. Please click the button below to continue.",
      goToApplication: "Go to Application",
    },
    common: {
      more: "More",
      viewAll: "View All",
      location: "Location",
      date: "Date",
      time: "Time",
      cost: "Cost",
      host: "Host",
      back: "Back",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      status: "Status",
      category: "Category",
    }
  }
} as const;

export type Dictionary = typeof i18n['ko'];
