'use client'

import { EditorRoot, EditorContent, type JSONContent } from 'novel'
import { defaultExtensions } from './novel-extensions'

interface NovelRendererProps {
  content: string
  className?: string
}

export function NovelRenderer({ content, className }: NovelRendererProps) {
  // Parse JSON content safely
  let initialContent: JSONContent | undefined
  try {
    initialContent = content ? JSON.parse(content) : undefined
  } catch {
    // If parsing fails, treat as HTML string
    return (
      <div 
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  // If no content, return null
  if (!initialContent) return null

  // Use same extensions as editor but without GlobalDragHandle and Placeholder for viewer
  const viewerExtensions = defaultExtensions.filter(
    ext => ext.name !== 'globalDragHandle' && ext.name !== 'placeholder'
  )

  return (
    <EditorRoot>
      <EditorContent
        extensions={viewerExtensions as any}
        initialContent={initialContent}
        editable={false}
        className={className}
        editorProps={{
          attributes: {
            class: 'prose prose-lg dark:prose-invert prose-headings:font-black prose-p:font-medium focus:outline-none max-w-full prose-img:max-w-full prose-img:h-auto prose-video:max-w-full prose-video:h-auto [&_iframe]:max-w-full [&_iframe]:h-auto [&_iframe]:aspect-video [&_embed]:max-w-full [&_embed]:h-auto'
          }
        }}
      />
    </EditorRoot>
  )
}
