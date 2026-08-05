/**
 * Where the package's motivation letter content came from. No motivation
 * letter concept exists anywhere in the domain yet, so today this is always
 * NOT_AVAILABLE — the full vocabulary is defined now so a future milestone
 * that introduces candidate-authored or generated letters needs no rename.
 */
export type MotivationLetterSource = 'NOT_AVAILABLE' | 'CANDIDATE_PROVIDED' | 'GENERATED_TEMPLATE';
