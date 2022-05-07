import { LoggerUtil } from "../logging/LoggerUtil";

/**
 * This helper class will read the file in chunks and then return as data urls
 */
export class CoreFileStreamer {
    private offset: number = 0;
    // private readonly defaultChunkSize: number = 64 * 1024;
    private readonly defaultChunkSize: number = 16 * 1024;

    constructor(private file: File) {
      this.rewind();
    }

    public rewind(): void {
      this.offset = 0;
    }

    public isEndOfFile(): boolean {
      return this.offset >= this.getFileSize();
    }

    public readBlockAsDataUrl(length: number = this.defaultChunkSize) {

      const fileReader: FileReader = new FileReader();
      const blob: Blob = this.file.slice(this.offset, this.offset + length);


      return new Promise<any>((resolve, reject) => {

        fileReader.onloadend = (event: ProgressEvent) => {
          const target: FileReader = (event.target) as FileReader;
          if (target.error == null) {
            const result: any = target.result;
            this.offset += result.length;
            // this.testEndOfFile();
            resolve(result);
          } else {
            reject(target.error);
          }
        };
        fileReader.readAsDataURL(blob);
      });
    }

    public readBlockAsArrayBuffer(length: number = this.defaultChunkSize) {

        const fileReader: FileReader = new FileReader();
        const blob: Blob = this.file.slice(this.offset, this.offset + length);

        return new Promise<any>((resolve, reject) => {

          fileReader.onloadend = (event: ProgressEvent) => {
            const target: FileReader = (event.target) as FileReader;
            if (target.error == null) {
              const result: any = target.result;
              this.offset += blob.size;
              // this.testEndOfFile();
              resolve(result);
            } else {
              reject(target.error);
            }
          };
          fileReader.readAsArrayBuffer(blob);
        });
      }

    // private testEndOfFile(): void {
    //   if (this.isEndOfFile()) {
    //     LoggerUtil.logAny('Done reading file');
    //   }
    // }

    private getFileSize(): number {
      return this.file.size;
    }
  }
