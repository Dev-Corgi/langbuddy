'use client'

import { useState } from 'react'
import { 
  EditorRoot, 
  EditorContent, 
  EditorCommand,
  EditorCommandItem,
  EditorCommandEmpty,
  EditorBubble,
  ImageResizer,
  handleCommandNavigation,
  type JSONContent 
} from 'novel'
import { defaultExtensions } from './novel-extensions'
import { slashCommand, suggestionItems } from './novel-slash-command'
import { NodeSelector } from './selectors/node-selector'
import { LinkSelector } from './selectors/link-selector'
import { ColorSelector } from './selectors/color-selector'
import { TextButtons } from './selectors/text-buttons'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase'

interface NovelEditorProps {
  value: string
  onChange: (value: string) => void
}

export function NovelEditor({ value, onChange }: NovelEditorProps) {
  const [openNode, setOpenNode] = useState(false)
  const [openLink, setOpenLink] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const supabase = createClient()

  // Parse initial content safely
  let initialContent: JSONContent | undefined
  try {
    initialContent = value ? JSON.parse(value) : undefined
  } catch {
    initialContent = undefined
  }

  return (
    <EditorRoot>
      <EditorContent
        extensions={[...defaultExtensions, slashCommand] as any}
        initialContent={initialContent}
        onUpdate={({ editor }) => {
          const json = editor.getJSON()
          onChange(JSON.stringify(json))
        }}
        className="relative min-h-[500px] w-full border-muted bg-background sm:rounded-lg sm:border sm:shadow-lg px-4"
        editorProps={{
          handleDOMEvents: {
            keydown: (_view, event) => handleCommandNavigation(event),
          },
          attributes: {
            class: 'prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full pl-8'
          }
        }}
        slotAfter={<ImageResizer />}
      >
        <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
          <EditorCommandEmpty className="px-2 text-muted-foreground">
            검색 결과 없음
          </EditorCommandEmpty>
          {suggestionItems.map((item) => (
            <EditorCommandItem
              value={item.title}
              onCommand={(val) => item.command?.(val)}
              className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent"
              key={item.title}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background">
                {item.icon}
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </EditorCommandItem>
          ))}
        </EditorCommand>

        <EditorBubble className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl">
          <NodeSelector open={openNode} onOpenChange={setOpenNode} />
          <Separator orientation="vertical" />
          <LinkSelector open={openLink} onOpenChange={setOpenLink} />
          <Separator orientation="vertical" />
          <TextButtons />
          <Separator orientation="vertical" />
          <ColorSelector open={openColor} onOpenChange={setOpenColor} />
        </EditorBubble>
      </EditorContent>
    </EditorRoot>
  )
}
