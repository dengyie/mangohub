"use client";

import { Github, Mail, Send } from 'lucide-react';
import { useState } from 'react';

const Footer = () => {
  const [emailCopied, setEmailCopied] = useState(false);

  const handleEmailClick = async () => {
    try {
      await navigator.clipboard.writeText('601560588@qq.com');
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  return (
    <footer className="relative overflow-hidden border-t border-border bg-card">
      <div className="container relative mx-auto px-8 py-6">
        {/* Social icons */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <a
            href="https://github.com/dengyie"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-all hover:border-foreground/40 hover:bg-secondary"
          >
            <Github className="h-4 w-4 text-muted-foreground" />
          </a>
          <a
            href="https://t.me/mangoqwqtech"
            target="_blank"
            rel="noreferrer"
            title="Telegram"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-all hover:border-foreground/40 hover:bg-secondary"
          >
            <Send className="h-4 w-4 text-muted-foreground" />
          </a>
          <button
            onClick={handleEmailClick}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background transition-all hover:border-foreground/40 hover:bg-secondary cursor-pointer"
            title="Click to copy email"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            {emailCopied && (
              <span className="absolute left-full ml-2 px-3 py-1.5 text-xs font-medium text-foreground bg-popover border border-border rounded-lg shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-200">
                ✓ Copied!
              </span>
            )}
          </button>
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-muted-foreground">
          <a href="https://github.com/dengyie/mangohub" target="_blank" rel="noreferrer" className="font-semibold text-foreground hover:text-primary transition-colors">Mango Hub</a>
          {' · '}
          <span>Every server at a glance</span>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
