import { environment } from "../../../environments/environment";

/**
 * Logger service
 */
export class LoggerUtil {
  private static LOG_STRING_TOKEN = "{}";

  public static logAny(message: any) {
    if (!environment.production || environment.is_native_app) {
      console.log(message);
    }
  }

  public static error(message: any) {
    console.log(message);
  }
}
