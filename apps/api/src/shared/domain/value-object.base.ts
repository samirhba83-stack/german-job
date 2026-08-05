/** Base class for value objects — identified by structural equality, not identity. */
export abstract class ValueObject<Props extends object> {
  protected readonly props: Props;

  protected constructor(props: Props) {
    this.props = Object.freeze(props);
  }

  equals(other?: ValueObject<Props>): boolean {
    if (!other) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
