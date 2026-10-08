import { type CountTemplates, formatCount } from "@/xornada/filter";

// A count in words, with its templates for the client to refill (F-4, B-3).
export function CountLabel({
  templates,
  n,
}: {
  templates: CountTemplates;
  n: number;
}) {
  return (
    <span data-label-one={templates.one} data-label-other={templates.other}>
      {formatCount(templates, n)}
    </span>
  );
}
