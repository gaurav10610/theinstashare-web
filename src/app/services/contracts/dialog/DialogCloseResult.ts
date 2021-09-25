import { DialogType } from "../enum/DialogType";

export interface DialogCloseResult {

    /**
     * type of dialog which is opened
     */
    type: DialogType;

    /**
     * dynamic data dialog has send
     */
    data: any;
}