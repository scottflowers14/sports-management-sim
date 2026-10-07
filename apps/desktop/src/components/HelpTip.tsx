import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { glossaryEntry, type GlossaryId } from '../glossary';

/** Opens the Help page; provided once by the app so every tip can link to it. */
export const OpenHelpContext = createContext<(() => void) | undefined>(undefined);

/**
 * A small "?" next to a term. Click or tap opens a short definition (hover
 * tooltips don't exist on touch and nobody finds them); Escape or a click
 * elsewhere closes it.
 */
export function HelpTip({ term }: { term: GlossaryId }) {
  const onOpenHelp = useContext(OpenHelpContext);
  const entry = glossaryEntry(term);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="help-tip" ref={ref}>
      <button
        type="button"
        className="help-tip-btn"
        aria-label={`What is ${entry.term}?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open && (
        <span id={id} role="tooltip" className="help-tip-pop">
          <strong>{entry.term}</strong>
          <span>{entry.definition}</span>
          {onOpenHelp && (
            <button type="button" className="link-btn help-tip-more" onClick={onOpenHelp}>
              All terms →
            </button>
          )}
        </span>
      )}
    </span>
  );
}
