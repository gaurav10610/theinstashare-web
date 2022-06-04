export interface BaseContextServiceSpec {
  cleanup(): Promise<boolean>;
}
