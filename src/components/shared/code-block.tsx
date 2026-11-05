"use client";
import * as React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// prism-react-renderer bundles a fixed set of grammars; map the rest to the closest one.
const ALIAS: Record<string, string> = { bash: "plain", shell: "plain", html: "markup", php: "clike", java: "clike", other: "plain" };

export function CodeBlock({ code, language, maxHeight, className }: { code: string; language: string; maxHeight?: number; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard. Select the code and copy it manually.");
    }
  }
  return (
    <div className={cn("group relative overflow-hidden rounded-lg border bg-[#011627]", className)}>
      <Button type="button" size="icon-sm" variant="ghost" onClick={copy} aria-label={copied ? "Copied" : "Copy code"} className="absolute top-2 right-2 z-10 text-slate-300 hover:bg-white/10 hover:text-white">
        {copied ? <Check /> : <Copy />}
      </Button>
      <Highlight theme={themes.nightOwl} code={code.replace(/\n$/, "")} language={ALIAS[language] ?? language}>
        {({ className: cls, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={cn(cls, "overflow-auto p-4 pr-12 font-mono text-[13px] leading-relaxed")} style={{ ...style, background: "transparent", maxHeight }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="mr-4 inline-block w-6 text-right text-slate-600 select-none">{i + 1}</span>
                {line.map((token, k) => (
                  <span key={k} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
