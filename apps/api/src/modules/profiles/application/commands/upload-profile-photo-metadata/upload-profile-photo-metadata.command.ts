export class UploadProfilePhotoMetadataCommand {
  constructor(
    public readonly userId: string,
    public readonly fileName: string,
    public readonly fileUrl: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
  ) {}
}
