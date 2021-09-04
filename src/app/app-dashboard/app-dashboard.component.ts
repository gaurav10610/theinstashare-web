import { Component, OnInit } from '@angular/core';
import { SignalingService } from '../services/signaling/signaling.service';
import { UserContextService } from '../services/context/user.context.service';

@Component({
  selector: 'app-app-dashboard',
  templateUrl: './app-dashboard.component.html',
  styleUrls: ['./app-dashboard.component.scss']
})
export class AppDashboardComponent implements OnInit {

  constructor(
    public signalingService: SignalingService,
    public userContextService: UserContextService
  ) { }

  tiles: any[];
  totalColumns: Number;

  ngOnInit(): void {
    if (this.userContextService.isMobile) {
      this.totalColumns = 2;
    } else {
      this.totalColumns = 6;
    }
    this.tiles = [
      { icon: 'fa-user-friends', cols: 1, rows: 1, color: 'black', appName: 'one to one'},
      { icon: 'fa-users', cols: 1, rows: 1, color: 'black', appName: 'group chat'}
    ];
  }

}
