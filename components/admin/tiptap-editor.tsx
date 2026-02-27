'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Button } from '@/components/ui/button'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Image as ImageIcon,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Loader2
} from 'lucide-react'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export function TiptapEditor({ value, onChange }: EditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [imageWidth, setImageWidth] = useState<string>('')
  const supabase = createClient()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: true,
        inline: true,
        HTMLAttributes: {
          class: 'rounded-lg cursor-pointer',
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-zinc max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  })

  if (!editor) return null

  const addImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return

    try {
      setIsUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `editor/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('postings')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('postings')
        .getPublicUrl(filePath)

      editor.chain().focus().setImage({ 
        src: publicUrl,
        alt: file.name,
        title: file.name,
      }).run()
    } catch (error: any) {
      console.error('Error uploading image:', error)
      const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.'
      alert(`이미지 업로드에 실패했습니다.\n오류: ${errorMessage}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <div className="bg-muted/50 border-b border-border p-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-accent' : ''}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-accent' : ''}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}
        >
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-accent' : ''}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-accent' : ''}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addImage}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        {editor.isActive('image') && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-muted-foreground">너비:</span>
            <input
              type="number"
              placeholder="px"
              value={imageWidth}
              onChange={(e) => {
                const width = e.target.value
                setImageWidth(width)
                if (width && !isNaN(Number(width))) {
                  editor.chain().focus().updateAttributes('image', {
                    width: `${width}px`,
                    style: `width: ${width}px; height: auto;`
                  }).run()
                }
              }}
              className="w-20 px-2 py-1 text-xs border border-border rounded bg-background"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setImageWidth('')
                editor.chain().focus().updateAttributes('image', {
                  width: null,
                  style: null
                }).run()
              }}
              className="text-xs"
            >
              초기화
            </Button>
          </div>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
