import { ValueObject } from '../../../../shared/domain';

interface SkillsProps {
  items: string[];
}

const MAX_SKILLS = 50;
const MAX_SKILL_LENGTH = 50;

export class Skills extends ValueObject<SkillsProps> {
  private constructor(props: SkillsProps) {
    super(props);
  }

  get items(): ReadonlyArray<string> {
    return this.props.items;
  }

  isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  static create(skills: string[]): Skills {
    const normalized = Array.from(
      new Set(skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0)),
    );

    if (normalized.length > MAX_SKILLS) {
      throw new Error(`A profile cannot have more than ${MAX_SKILLS} skills`);
    }

    const tooLong = normalized.find((skill) => skill.length > MAX_SKILL_LENGTH);
    if (tooLong) {
      throw new Error(`Skill name exceeds ${MAX_SKILL_LENGTH} characters: ${tooLong}`);
    }

    return new Skills({ items: normalized });
  }

  static empty(): Skills {
    return new Skills({ items: [] });
  }
}
