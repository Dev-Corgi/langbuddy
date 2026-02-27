import { Command, createSuggestionItems, renderItems, type SuggestionItem } from 'novel'
import { 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Text,
  Code,
  CheckSquare,
  Quote,
  ImageIcon,
  Minus,
  Youtube,
  Link2,
  Table,
  Columns,
  MessageSquare,
  FileText,
  Highlighter,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

export const suggestionItems: SuggestionItem[] = createSuggestionItems([
  {
    title: '텍스트',
    description: '일반 텍스트 단락',
    searchTerms: ['p', 'paragraph', 'text', '텍스트', '단락'],
    icon: <Text size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .run()
    },
  },
  {
    title: '제목 1',
    description: '가장 큰 제목',
    searchTerms: ['title', 'big', 'large', 'h1', '제목', '큰'],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 1 })
        .run()
    },
  },
  {
    title: '제목 2',
    description: '중간 크기 제목',
    searchTerms: ['subtitle', 'medium', 'h2', '제목', '중간'],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 2 })
        .run()
    },
  },
  {
    title: '제목 3',
    description: '작은 제목',
    searchTerms: ['subtitle', 'small', 'h3', '제목', '작은'],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 3 })
        .run()
    },
  },
  {
    title: '글머리 기호 목록',
    description: '간단한 글머리 기호 목록',
    searchTerms: ['unordered', 'point', 'ul', '목록', '리스트', 'bullet'],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: '번호 매기기 목록',
    description: '번호가 매겨진 목록',
    searchTerms: ['ordered', 'ol', '번호', '숫자', 'numbered'],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: '할 일 목록',
    description: '체크박스가 있는 할 일 목록',
    searchTerms: ['todo', 'task', 'list', 'check', 'checkbox', '체크', '할일'],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: '인용',
    description: '인용문 블록',
    searchTerms: ['blockquote', 'quote', '인용', '인용문'],
    icon: <Quote size={18} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .toggleBlockquote()
        .run(),
  },
  {
    title: '코드 블록',
    description: '코드를 작성하는 블록',
    searchTerms: ['codeblock', 'code', '코드', 'programming'],
    icon: <Code size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: '구분선',
    description: '수평선으로 내용 구분',
    searchTerms: ['hr', 'horizontal', 'rule', 'divider', '구분선', '선', 'line'],
    icon: <Minus size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: '이미지',
    description: '컴퓨터에서 이미지를 업로드합니다.',
    searchTerms: ['photo', 'picture', 'media', 'img', 'image'],
    icon: <ImageIcon size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async () => {
        if (input.files?.length) {
          const file = input.files[0]
          const supabase = createClient()
          
          try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
            const filePath = `editor/${fileName}`

            const { error: uploadError } = await supabase.storage
              .from('postings')
              .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
              .from('postings')
              .getPublicUrl(filePath)

            editor.chain().focus().setImage({ src: publicUrl }).run()
          } catch (error: any) {
            console.error('Error uploading image:', error)
            alert(`이미지 업로드에 실패했습니다.\n오류: ${error?.message || '알 수 없는 오류'}`)
          }
        }
      }
      input.click()
    },
  },
  {
    title: 'YouTube',
    description: 'YouTube 동영상 임베드',
    searchTerms: ['youtube', 'video', 'embed', '유튜브', '동영상'],
    icon: <Youtube size={18} />,
    command: ({ editor, range }) => {
      const url = prompt('YouTube URL을 입력하세요:')
      if (url) {
        editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run()
      }
    },
  },
  {
    title: '링크',
    description: '텍스트에 링크 추가',
    searchTerms: ['link', 'url', 'hyperlink', '링크', '하이퍼링크'],
    icon: <Link2 size={18} />,
    command: ({ editor, range }) => {
      const url = prompt('링크 URL을 입력하세요:')
      if (url) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(`<a href="${url}">${url}</a>`)
          .run()
      }
    },
  },
])

export const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
})
