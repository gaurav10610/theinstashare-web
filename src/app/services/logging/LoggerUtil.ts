import { environment } from '../../../environments/environment';

/**
 * Logger service
 */
export class LoggerUtil {

  public static log(message: any) {
    if (!environment.production || environment.is_native_app) {
      console.log(message);
    }
  }
}
