import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-file-transfer-window',
  templateUrl: './file-transfer-window.component.html',
  styleUrls: ['./file-transfer-window.component.scss']
})
export class FileTransferWindowComponent implements OnInit, OnDestroy {

  constructor() { }

  ngOnInit(): void {
  }

  /**
   * do clean up here before this component  get destroyed
   */
  ngOnDestroy(): void {
  }

}
