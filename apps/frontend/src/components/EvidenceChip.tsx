import type { EvidenceSource } from '../types';

interface Props {
  source: EvidenceSource;
}

const TYPE_ICON: Record<EvidenceSource['type'], string> = {
  pubmed: '🔬',
  clinicaltrials: '🏥',
  web: '🌐',
  unknown: '📄',
};

function resolveUrl(source: EvidenceSource): string | null {
  const id = source.identifier;
  if (!id) return null;
  if (source.type === 'pubmed') {
    // e.g. "PMID:12345678" or bare numeric
    const pmid = id.replace(/^PMID:/i, '').trim();
    if (/^\d+$/.test(pmid)) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  }
  if (source.type === 'clinicaltrials') {
    const nct = id.match(/NCT\d+/i)?.[0];
    if (nct) return `https://clinicaltrials.gov/study/${nct}`;
  }
  if (source.type === 'web' || /^https?:\/\//.test(id)) {
    return id.startsWith('http') ? id : null;
  }
  return null;
}

function formatLabel(source: EvidenceSource): string {
  const id = source.identifier;
  if (!id) return source.type;
  if (source.type === 'web' && id.length > 30) {
    try {
      const url = new URL(id.startsWith('http') ? id : `https://${id}`);
      return url.hostname;
    } catch {
      return id.slice(0, 28) + '…';
    }
  }
  return id;
}

export default function EvidenceChip({ source }: Props) {
  const url = resolveUrl(source);
  const icon = TYPE_ICON[source.type];
  const label = formatLabel(source);

  const inner = (
    <>
      <span>{icon}</span>
      <span>{label}</span>
      {source.type === 'web' && (
        <span className="evidence-chip-not-pr" title="Not peer-reviewed">
          ⚠ NOT peer-reviewed
        </span>
      )}
    </>
  );

  if (url) {
    return (
      <a
        className={`evidence-chip clickable ${source.type}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={source.description || source.identifier}
      >
        {inner}
      </a>
    );
  }

  return (
    <span
      className={`evidence-chip ${source.type}`}
      title={source.description || source.identifier}
    >
      {inner}
    </span>
  );
}
