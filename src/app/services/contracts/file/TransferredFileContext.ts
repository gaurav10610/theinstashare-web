export interface TransferredFileContext {
    id: string;
    fileName: string;
    isDownloaded: boolean;
    downloadProgress?: number;
    uploadProgress?: number;
    fileExtension: string;
    isFragmented: boolean;
    fragmentOffset: number;
    totalFragments: number;
    fileBuffer: any[];
    lastPartReceivedAt: Date;
    lastAcknowledgementAt: Date;
    from: string;
    isPaused: boolean;
}