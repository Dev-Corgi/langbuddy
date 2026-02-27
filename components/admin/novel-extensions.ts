import { 
  UpdatedImage,
  StarterKit,
  TaskList,
  TaskItem,
  TiptapUnderline,
  TextStyle,
  Color,
  TiptapLink,
  HorizontalRule,
  Youtube,
  GlobalDragHandle,
  Placeholder,
  HighlightExtension,
} from 'novel'

export const defaultExtensions = [
  GlobalDragHandle,
  HighlightExtension,
  StarterKit.configure({
    bulletList: {
      HTMLAttributes: {
        class: 'list-disc list-outside leading-3 -mt-2',
      },
    },
    orderedList: {
      HTMLAttributes: {
        class: 'list-decimal list-outside leading-3 -mt-2',
      },
    },
    listItem: {
      HTMLAttributes: {
        class: 'leading-normal -mb-2',
      },
    },
    blockquote: {
      HTMLAttributes: {
        class: 'border-l-4 border-primary',
      },
    },
    codeBlock: {
      HTMLAttributes: {
        class: 'rounded-md bg-muted text-muted-foreground border p-5 font-mono font-medium',
      },
    },
    code: {
      HTMLAttributes: {
        class: 'rounded-md bg-muted px-1.5 py-1 font-mono font-medium',
        spellcheck: 'false',
      },
    },
    horizontalRule: false,
    dropcursor: {
      color: '#DBEAFE',
      width: 4,
    },
    gapcursor: false,
  }),
  HorizontalRule.configure({
    HTMLAttributes: {
      class: 'my-4 border-t border-muted',
    },
  }),
  Youtube.configure({
    HTMLAttributes: {
      class: 'rounded-lg border border-muted',
    },
    width: 640,
    height: 480,
  }),
  TiptapLink.configure({
    HTMLAttributes: {
      class: 'text-primary underline underline-offset-[3px] hover:text-primary/80 cursor-pointer',
    },
  }),
  UpdatedImage.configure({
    HTMLAttributes: {
      class: 'rounded-lg border border-muted',
    },
  }),
  Placeholder.configure({
    placeholder: '내용을 입력하거나 "/"를 눌러 명령어를 사용하세요...',
  }),
  TiptapUnderline,
  TextStyle,
  Color,
  TaskList.configure({
    HTMLAttributes: {
      class: 'not-prose pl-2',
    },
  }),
  TaskItem.configure({
    HTMLAttributes: {
      class: 'flex items-start my-4',
    },
    nested: true,
  }),
]
