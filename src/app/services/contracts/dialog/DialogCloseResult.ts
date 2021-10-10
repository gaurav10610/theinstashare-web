import { DialogCloseResultType } from "../enum/DialogCloseResultType";

export interface DialogCloseResult {

    /**
     * type of dialog which is opened
     */
    type: DialogCloseResultType;

    /**
     * dynamic data dialog has send
     */
    data: any;
}