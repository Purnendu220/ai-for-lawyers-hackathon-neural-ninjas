/**
 * User-facing text for warning codes stored on documents and analyses. Warnings written by the
 * model are already sentences and pass through unchanged.
 */
export function describeWarning(warning: string): string {
  const empty = /^(page|section)_(\d+)_no_text$/.exec(warning);
  if (empty) {
    return `${empty[1] === 'page' ? 'Page' : 'Section'} ${empty[2]} has no readable text, so nothing on it could be extracted.`;
  }
  const truncated = /^pages_truncated_(\d+)_of_(\d+)$/.exec(warning);
  if (truncated) {
    return `Only the first ${truncated[1]} of ${truncated[2]} pages were analysed. Review the rest of the document yourself.`;
  }
  return warning;
}

export const pagesTruncatedWarning = (analysed: number, total: number) =>
  `pages_truncated_${analysed}_of_${total}`;
