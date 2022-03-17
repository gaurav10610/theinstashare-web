import { environment } from '../../../environments/environment';

/**
 * Logger service
 */
export class LoggerUtil {

  private static LOG_STRING_TOKEN = '{}';

  public static logAny(message: any) {
    if (!environment.production || environment.is_native_app) {
      console.log(message);
    }
  }

  /**
   * this will print string logs by replacing the tokens with string tokens
   * 
   * @param logString log string containing tokens(i.e '{}')
   * @param tokens string objects to replace tokens
   */
  public static logString(logString: string, ...tokens: string[]) {
    if (!environment.production || environment.is_native_app) {
      let values = logString.split(' ')
      let i = 0;
      if (tokens && tokens.length > 0) {
        for (let j = 0; j < values.length; j++) {
          if (values[j] === LoggerUtil.LOG_STRING_TOKEN) {
            if (tokens[i]) {
              values[j] = tokens[i]
              i++
            } else {
              break;
            }
          }
        }
        console.log(values.join(' '))
      } else {
        console.log(logString)
      }
    }
  }
}
