import { Component, Inject, OnInit } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import {
  DialogCloseResult,
  InfoDialogContext,
} from "../services/contracts/dialog/dialog";
import { DialogCloseResultType } from "../services/contracts/enum/DialogCloseResultType";

@Component({
  selector: "app-information-dialog",
  templateUrl: "./information-dialog.component.html",
  styleUrls: ["./information-dialog.component.scss"],
})
export class InformationDialogComponent implements OnInit {
  infoContext: InfoDialogContext;
  constructor(
    private dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) private data: InfoDialogContext
  ) {
    this.infoContext = data;
  }

  ngOnInit(): void {}

  dialogClose() {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.INFORMATIONAL,
      data: {},
    };
    this.dialogRef.close(result);
  }
}
