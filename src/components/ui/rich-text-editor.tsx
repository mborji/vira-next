import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  TextQuote,
  Underline,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getPlainTextFromHtml,
  normalizeRichTextValue,
  sanitizeRichText,
} from "@/lib/richText";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "متن را وارد کنید",
  className,
  editorClassName,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const normalizedValue = useMemo(
    () => normalizeRichTextValue(value),
    [value]
  );

  useEffect(() => {
    if (!editorRef.current || editorRef.current.innerHTML === normalizedValue) {
      return;
    }

    editorRef.current.innerHTML = normalizedValue;
  }, [normalizedValue]);

  const syncValue = () => {
    if (!editorRef.current) {
      return;
    }

    onChange(sanitizeRichText(editorRef.current.innerHTML));
  };

  const runCommand = (command: string, commandValue?: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command, false, commandValue);
    syncValue();
  };

  const addLink = () => {
    const url = window.prompt("آدرس لینک را وارد کنید");
    if (!url) {
      return;
    }

    runCommand("createLink", url);
  };

  const hasContent = getPlainTextFromHtml(normalizedValue).length > 0;

  const actions = [
    { icon: Bold, label: "بولد", onClick: () => runCommand("bold") },
    { icon: Italic, label: "ایتالیک", onClick: () => runCommand("italic") },
    { icon: Underline, label: "زیرخط", onClick: () => runCommand("underline") },
    {
      icon: Heading2,
      label: "تیتر",
      onClick: () => runCommand("formatBlock", "h2"),
    },
    {
      icon: List,
      label: "لیست",
      onClick: () => runCommand("insertUnorderedList"),
    },
    {
      icon: ListOrdered,
      label: "شماره‌دار",
      onClick: () => runCommand("insertOrderedList"),
    },
    {
      icon: TextQuote,
      label: "نقل‌قول",
      onClick: () => runCommand("formatBlock", "blockquote"),
    },
    { icon: Link2, label: "لینک", onClick: addLink },
    {
      icon: RemoveFormatting,
      label: "حذف قالب",
      onClick: () => runCommand("removeFormat"),
    },
  ];

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap gap-1 border-b p-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={action.label}
            aria-label={action.label}
          >
            <action.icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="relative">
        {!hasContent && !isFocused && (
          <span className="pointer-events-none absolute right-4 top-4 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          dir="rtl"
          className={cn(
            "min-h-[220px] rounded-b-md p-4 outline-none [&_blockquote]:border-r-2 [&_blockquote]:border-primary/40 [&_blockquote]:pr-4 [&_div]:mb-3 [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_ol]:list-decimal [&_ol]:pr-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pr-6",
            editorClassName
          )}
          onInput={syncValue}
          onBlur={() => {
            setIsFocused(false);
            syncValue();
          }}
          onFocus={() => setIsFocused(true)}
        />
      </div>
    </div>
  );
};
