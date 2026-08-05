import { AvailabilityStatus } from '@german-job-engine/shared-types';
import { ValueObject } from '../../../../shared/domain';

interface AvailabilityProps {
  status: AvailabilityStatus;
  availableFrom: Date | null;
}

export class Availability extends ValueObject<AvailabilityProps> {
  private constructor(props: AvailabilityProps) {
    super(props);
  }

  get status(): AvailabilityStatus {
    return this.props.status;
  }

  get availableFrom(): Date | null {
    return this.props.availableFrom;
  }

  static create(status: AvailabilityStatus, availableFrom?: Date | null): Availability {
    return new Availability({ status, availableFrom: availableFrom ?? null });
  }
}
