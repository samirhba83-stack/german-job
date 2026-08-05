import { ValueObject } from '../../../../shared/domain';

interface AusbildungAvailabilityProps {
  isAusbildungPosition: boolean;
  durationMonths: number | null;
}

const MAX_DURATION_MONTHS = 60;

export class AusbildungAvailability extends ValueObject<AusbildungAvailabilityProps> {
  private constructor(props: AusbildungAvailabilityProps) {
    super(props);
  }

  get isAusbildungPosition(): boolean {
    return this.props.isAusbildungPosition;
  }

  get durationMonths(): number | null {
    return this.props.durationMonths;
  }

  static create(props: { isAusbildungPosition: boolean; durationMonths?: number | null }): AusbildungAvailability {
    const durationMonths = props.durationMonths ?? null;

    if (durationMonths !== null && (durationMonths <= 0 || durationMonths > MAX_DURATION_MONTHS)) {
      throw new Error(`Ausbildung duration must be between 1 and ${MAX_DURATION_MONTHS} months`);
    }

    return new AusbildungAvailability({
      isAusbildungPosition: props.isAusbildungPosition,
      durationMonths,
    });
  }
}
