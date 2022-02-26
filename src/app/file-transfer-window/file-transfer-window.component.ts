import { Component, OnDestroy, OnInit } from '@angular/core';
import { GoogleAnalyticsService } from 'ngx-google-analytics';

@Component({
  selector: 'app-file-transfer-window',
  templateUrl: './file-transfer-window.component.html',
  styleUrls: ['./file-transfer-window.component.scss']
})
export class FileTransferWindowComponent implements OnInit, OnDestroy {

  constructor(
    private gaService: GoogleAnalyticsService
  ) { }

  ngOnInit(): void {
    this.gaService.pageView('/file-transfer', 'File Transfer');
  }

  /**
   * do clean up here before this component  get destroyed
   */
  ngOnDestroy(): void {
  }

}
