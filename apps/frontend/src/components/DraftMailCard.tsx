import { useState } from 'react';
import type { MailDraft } from '../types';

interface Props {
  draft: MailDraft;
}

export default function DraftMailCard({ draft }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="draft-mail-card">
      <div className="draft-mail-header">
        <span className="draft-badge">DRAFT</span>
        <span className="draft-mail-title">Email Draft — Ready for Review</span>
      </div>

      <div className="draft-mail-meta">
        <span className="draft-label">To:</span>
        <span className="draft-value">{draft.to}</span>
      </div>
      <div className="draft-mail-meta">
        <span className="draft-label">Subject:</span>
        <span className="draft-value">{draft.subject}</span>
      </div>

      <div className="draft-mail-body">
        <pre>{draft.body}</pre>
      </div>

      <div className="draft-mail-footer">
        <span className="draft-notice">
          ⚠ No send capability — copy the draft and send from your email client.
        </span>
        <button className="copy-draft-btn" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  );
}
