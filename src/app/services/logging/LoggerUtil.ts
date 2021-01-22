import { environment } from '../../../environments/environment';

/**
 * Logger service
 */
export class LoggerUtil {

  public static log(msgToLog: any) {
    if (!environment.production || environment.is_native_app) {
      console.log(msgToLog);
    }
  }
}
