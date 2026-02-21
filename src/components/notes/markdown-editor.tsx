"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  height = 300,
  placeholder = "Write something…",
}: MarkdownEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const md = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
      onChange(md.markdown.getMarkdown());
    },
    editorProps: {
      attributes: { class: "note-editor focus:outline-none" },
    },
  });

  if (!editor) return null;

  const btn = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    active = false,
    disabled = false,
  ) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      onClick={action}
      disabled={disabled}
      className={cn("h-7 w-7", active && "bg-accent text-accent-foreground")}
    >
      {icon}
    </Button>
  );

  const ic = (size = "h-3.5 w-3.5") => ({ className: size });

  return (
    <div
      className="flex flex-col overflow-hidden rounded-md border"
      style={{ minHeight: height }}
    >
      {/* ── Toolbar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1">
        {btn("Bold", <Bold {...ic()} />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {btn("Italic", <Italic {...ic()} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {btn("Strikethrough", <Strikethrough {...ic()} />, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        {btn("Inline code", <Code {...ic()} />, () => editor.chain().focus().toggleCode().run(), editor.isActive("code"))}

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        {btn("Heading 1", <Heading1 {...ic()} />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
        {btn("Heading 2", <Heading2 {...ic()} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
        {btn("Heading 3", <Heading3 {...ic()} />, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        {btn("Bullet list", <List {...ic()} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {btn("Ordered list", <ListOrdered {...ic()} />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {btn("Blockquote", <Quote {...ic()} />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        {btn("Code block", <Code2 {...ic()} />, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
        {btn("Divider", <Minus {...ic()} />, () => editor.chain().focus().setHorizontalRule().run())}

        <Separator orientation="vertical" className="mx-0.5 h-5" />

        {btn("Undo", <Undo2 {...ic()} />, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {btn("Redo", <Redo2 {...ic()} />, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
      </div>

      {/* ── Content ── */}
      <div
        className="min-h-0 flex-1 cursor-text overflow-auto px-4 py-3"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
