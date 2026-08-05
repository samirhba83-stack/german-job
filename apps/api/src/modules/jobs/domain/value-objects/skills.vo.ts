import { ValueObject } from '../../../../shared/domain';

interface SkillsProps {
  required: string[];
  niceToHave: string[];
}

const MAX_SKILLS = 50;
const MAX_SKILL_LENGTH = 50;

/**
 * Splits skills into required vs nice-to-have — this distinction is what a future
 * Smart Campaign / AI matching engine needs for weighted matching, so it's modeled
 * up front rather than as an undifferentiated flat list.
 */
export class Skills extends ValueObject<SkillsProps> {
  private constructor(props: SkillsProps) {
    super(props);
  }

  get required(): ReadonlyArray<string> {
    return this.props.required;
  }

  get niceToHave(): ReadonlyArray<string> {
    return this.props.niceToHave;
  }

  isEmpty(): boolean {
    return this.props.required.length === 0 && this.props.niceToHave.length === 0;
  }

  static create(props: { required?: string[]; niceToHave?: string[] }): Skills {
    const required = Skills.normalize(props.required ?? []);
    const niceToHave = Skills.normalize(props.niceToHave ?? []).filter((skill) => !required.includes(skill));

    if (required.length + niceToHave.length > MAX_SKILLS) {
      throw new Error(`A job cannot have more than ${MAX_SKILLS} skills in total`);
    }

    return new Skills({ required, niceToHave });
  }

  static empty(): Skills {
    return new Skills({ required: [], niceToHave: [] });
  }

  private static normalize(skills: string[]): string[] {
    const normalized = Array.from(
      new Set(skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0)),
    );

    const tooLong = normalized.find((skill) => skill.length > MAX_SKILL_LENGTH);
    if (tooLong) {
      throw new Error(`Skill name exceeds ${MAX_SKILL_LENGTH} characters: ${tooLong}`);
    }

    return normalized;
  }
}
