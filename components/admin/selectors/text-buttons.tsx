// @ts-nocheck
import { Bold, Italic, Underline, Strikethrough, Code } from "lucide-react"
import { EditorBubbleItem, useEditor } from "novel"

export const TextButtons = () => {
  const { editor } = useEditor()
  if (!editor) return null

  return (
    <div className="flex">
      <EditorBubbleItem
        onSelect={(editor) => {
          editor.chain().focus().toggleBold().run()
        }}
        className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Bold className="h-4 w-4" />
      </EditorBubbleItem>
      <EditorBubbleItem
        onSelect={(editor) => {
          editor.chain().focus().toggleItalic().run()
        }}
        className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Italic className="h-4 w-4" />
      </EditorBubbleItem>
      <EditorBubbleItem
        onSelect={(editor) => {
          editor.chain().focus().toggleUnderline().run()
        }}
        className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Underline className="h-4 w-4" />
      </EditorBubbleItem>
      <EditorBubbleItem
        onSelect={(editor) => {
          editor.chain().focus().toggleStrike().run()
        }}
        className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Strikethrough className="h-4 w-4" />
      </EditorBubbleItem>
      <EditorBubbleItem
        onSelect={(editor) => {
          editor.chain().focus().toggleCode().run()
        }}
        className="p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Code className="h-4 w-4" />
      </EditorBubbleItem>
    </div>
  )
}
