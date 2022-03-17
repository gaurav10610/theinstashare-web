import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { TalkWindowContextService } from '../context/talk-window-context.service';
import { UserContextService } from '../context/user.context.service';
import { CoreDataChannelService } from '../data-channel/core-data-channel.service';
import { LoggerUtil } from '../logging/LoggerUtil';
import { TalkWindowUtilityService } from '../util/talk-window-utility.service';
import { TalkWindowWebrtcService } from '../webrtc/talk-window-webrtc.service';

@Injectable({
  providedIn: 'root'
})
export class WebRemoteAccessService {

  private renderer: Renderer2;

  constructor(
    private rendererFactory: RendererFactory2,
    private userContextService: UserContextService,
    private talkWindowContextService: TalkWindowContextService,
    private talkWindowUtilService: TalkWindowUtilityService,
    private coreDataChannelService: CoreDataChannelService
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  /**
   * these are some variables used by remote access mechanism
   * 
   */
  noOfMouseDowns: number = 0;
  noOfMouseUps: number = 0;
  mouseUpDelay: number = 250;

  /**
   * this will handle resize screen event when user is accessing a remote machine to re-calculate 
   * parameters like plane coordinates ratio which will be used by remote access mechanism
   *  
   * @param remoteVideoWidth remote video width 
   * 
   * @param remoteVideoHeight remote videp height
   * 
   * @param localRemoteVideoWidth local remote video width
   * 
   * @param localRemoteVideoHeight local remote video height
   * 
   * @param remoteVideo remote video html native element 
   * 
   * @param remoteVideoCanvas remote video html native element
   */
  calculateRemoteAccessParameters(remoteVideoWidth: any, remoteVideoHeight: any,
    localRemoteVideoWidth: any, localRemoteVideoHeight: any,
    remoteVideo: any, remoteVideoCanvas: any) {
    LoggerUtil.logAny(remoteVideo.nativeElement.clientWidth);
    LoggerUtil.logAny(remoteVideo.nativeElement.clientHeight);


    /**
     * set remote height and width in remote access context
     */
    this.talkWindowContextService.remoteAccessContext['remoteHeight'] = remoteVideoHeight;
    this.talkWindowContextService.remoteAccessContext['remoteWidth'] = remoteVideoWidth;

    let minHeight: any;
    let minWidth: any;

    /**
     * check here if height of viewer device is less than it's width then set/scale 
     * only height of the video tag and blank canvas over it after it width will be 
     * scaled automatically.
     * 
     * if width of viewer device is less than it's height then do vice-versa of above  
     * 
     */
    // if (localRemoteVideoHeight < localRemoteVideoWidth) {

    //   minHeight = Math.min(remoteVideoHeight, localRemoteVideoHeight);
    //   this.renderer.setProperty(remoteVideo.nativeElement, 'height', minHeight);
    //   this.talkWindowUtilService.appRef.tick();

    //   minWidth = remoteVideo.nativeElement.clientWidth;
    //   this.renderer.setProperty(remoteVideoCanvas.nativeElement, 'height', minHeight);
    //   this.renderer.setProperty(remoteVideoCanvas.nativeElement, 'width', minWidth);
    //   this.talkWindowUtilService.appRef.tick();
    // } else {

    //   minWidth = Math.min(remoteVideoWidth, localRemoteVideoWidth);
    //   this.renderer.setProperty(remoteVideo.nativeElement, 'width', minWidth);
    //   this.talkWindowUtilService.appRef.tick();

    //   minHeight = remoteVideo.nativeElement.clientHeight;
    //   this.renderer.setProperty(remoteVideoCanvas.nativeElement, 'height', minHeight);
    //   this.renderer.setProperty(remoteVideoCanvas.nativeElement, 'width', minWidth);
    //   this.talkWindowUtilService.appRef.tick();
    // }

    minHeight = remoteVideo.nativeElement.clientHeight;
    minWidth = remoteVideo.nativeElement.clientWidth;

    //this is temporary
    this.renderer.setProperty(remoteVideoCanvas.nativeElement, 'height', minHeight);
    this.renderer.setProperty(remoteVideoCanvas.nativeElement, 'width', minWidth);
    this.talkWindowUtilService.appRef.tick();

    this.talkWindowContextService.remoteAccessContext['heightScalingRatio'] = remoteVideoHeight / minHeight;
    this.talkWindowContextService.remoteAccessContext['widthScalingRatio'] = remoteVideoWidth / minWidth;

    this.talkWindowContextService.remoteAccessContext['offsetLeft'] = remoteVideoCanvas.nativeElement.getBoundingClientRect().left;
    this.talkWindowContextService.remoteAccessContext['offsetTop'] = remoteVideoCanvas.nativeElement.getBoundingClientRect().top;
    LoggerUtil.logAny(this.talkWindowContextService.remoteAccessContext);
  }

  /**
   * this will register all the event listeners required for remote access 
   * on blank canvas over remote video
   *  
   * @param remoteVideoCanvas remote video html native element
   */
  registerRemoteAccessEventListeners(remoteVideoCanvas: any) {
    /**
     * register 'mousedown' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'mousedown', (event) => {
        //LoggerUtil.log(event);

        //increase number of left clicks
        this.noOfMouseDowns++;
        setTimeout(() => { this.noOfMouseDowns = 0 }, this.mouseUpDelay);

        if (this.noOfMouseDowns === 2) {

          this.coreDataChannelService.sendMessageOnDataChannel({
            from: this.userContextService.username,
            to: this.userContextService.userToChat,
            type: AppConstants.REMOTE_CONTROL,
            clientX: (event.clientX - this.talkWindowContextService.remoteAccessContext['offsetLeft']),
            clientY: (event.clientY - this.talkWindowContextService.remoteAccessContext['offsetTop']),
            widthRatio: this.talkWindowContextService.remoteAccessContext['widthScalingRatio'],
            heightRatio: this.talkWindowContextService.remoteAccessContext['heightScalingRatio'],
            eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.DOUBLE_CLICK_MOUSE_DOWN,
            clickType: AppConstants.MOUSE_BUTTONS_MAP[event.button]
          }, AppConstants.REMOTE_CONTROL);
          this.noOfMouseDowns = 0;
        } else {

          this.coreDataChannelService.sendMessageOnDataChannel({
            from: this.userContextService.username,
            to: this.userContextService.userToChat,
            type: AppConstants.REMOTE_CONTROL,
            clientX: (event.clientX - this.talkWindowContextService.remoteAccessContext['offsetLeft']),
            clientY: (event.clientY - this.talkWindowContextService.remoteAccessContext['offsetTop']),
            widthRatio: this.talkWindowContextService.remoteAccessContext['widthScalingRatio'],
            heightRatio: this.talkWindowContextService.remoteAccessContext['heightScalingRatio'],
            eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.MOUSE_DOWN,
            clickType: AppConstants.MOUSE_BUTTONS_MAP[event.button]
          }, AppConstants.REMOTE_CONTROL);
        }
      })
    );

    /**
     * register 'mouseup' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'mouseup', (event) => {
        //LoggerUtil.log(event);

        this.noOfMouseUps++;
        setTimeout(() => { this.noOfMouseUps = 0 }, this.mouseUpDelay);

        if (this.noOfMouseUps === 2) {
          this.noOfMouseUps = 0;
        } else {
          /**
           * send mouseup event
           * 
           */
          this.coreDataChannelService.sendMessageOnDataChannel({
            from: this.userContextService.username,
            to: this.userContextService.userToChat,
            type: AppConstants.REMOTE_CONTROL,
            clientX: (event.clientX - this.talkWindowContextService.remoteAccessContext['offsetLeft']),
            clientY: (event.clientY - this.talkWindowContextService.remoteAccessContext['offsetTop']),
            widthRatio: this.talkWindowContextService.remoteAccessContext['widthScalingRatio'],
            heightRatio: this.talkWindowContextService.remoteAccessContext['heightScalingRatio'],
            eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.MOUSE_UP,
            clickType: AppConstants.MOUSE_BUTTONS_MAP[event.button]
          }, AppConstants.REMOTE_CONTROL);
        }

      })
    );

    /**
     * register 'mousemove' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'mousemove', (event) => {
        //LoggerUtil.log(event);
        this.coreDataChannelService.sendMessageOnDataChannel({
          from: this.userContextService.username,
          to: this.userContextService.userToChat,
          type: AppConstants.REMOTE_CONTROL,
          clientX: (event.clientX - this.talkWindowContextService.remoteAccessContext['offsetLeft']),
          clientY: (event.clientY - this.talkWindowContextService.remoteAccessContext['offsetTop']),
          widthRatio: this.talkWindowContextService.remoteAccessContext['widthScalingRatio'],
          heightRatio: this.talkWindowContextService.remoteAccessContext['heightScalingRatio'],
          eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.MOUSE_MOVE
        }, AppConstants.REMOTE_CONTROL);
      })
    );

    /**
     * register 'wheel' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'wheel', (event) => {
        //LoggerUtil.log(event);

        /**
         * send mouse wheel scroll event
         * 
         */
        this.coreDataChannelService.sendMessageOnDataChannel({
          from: this.userContextService.username,
          to: this.userContextService.userToChat,
          type: AppConstants.REMOTE_CONTROL,
          deltaY: event.deltaY,
          eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.WHEEL
        }, AppConstants.REMOTE_CONTROL);
      })
    );

    /**
     * register 'keydown' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'keydown', (event) => {
        //LoggerUtil.log(event);

        /**
         * this is selection event
         */
        if (event.keyCode === 65) {
          if ((this.talkWindowContextService.remoteAccessContext['localOS'] === 'win' && event.ctrlKey)
            || (this.talkWindowContextService.remoteAccessContext['localOS'] === 'mac' && event.metaKey)) {
            this.coreDataChannelService.sendMessageOnDataChannel({
              from: this.userContextService.username,
              to: this.userContextService.userToChat,
              type: AppConstants.REMOTE_CONTROL,
              eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.SELECT,
            }, AppConstants.REMOTE_CONTROL);
            return;
          }
        }

        /**
         * this is a paste event
         * 
         * @TODO see if this can work somehow
         */
        // if (event.keyCode === 86) {
        //   if ((this.talkWindowContextService.remoteAccessContext['localOS'] === 'win' && event.ctrlKey)
        //     || (this.talkWindowContextService.remoteAccessContext['localOS'] === 'mac' && event.metaKey)) {
        //     //LoggerUtil.log(event);
        //     this.webrtcService.sendMessageOnDataChannel({
        //       from: this.userContextService.username,
        //       to: this.userContextService.userToChat,
        //       type: AppConstants.REMOTE_CONTROL,
        //       eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.PASTE,
        //       data: event.clipboardData.getData('Text')
        //     }, AppConstants.REMOTE_CONTROL);
        //     return;
        //   }
        // }

        /**
         * this is default key press handling
         */
        this.coreDataChannelService.sendMessageOnDataChannel({
          from: this.userContextService.username,
          to: this.userContextService.userToChat,
          type: AppConstants.REMOTE_CONTROL,
          eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.KEY_DOWN,
          keyCode: event.keyCode,
          shift: event.shiftKey,
          meta: event.metaKey,
          control: event.ctrlKey,
          alt: event.altKey,
          capslock: event.getModifierState('CapsLock'),
        }, AppConstants.REMOTE_CONTROL);
      })
    );

    /**
     * register 'paste' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'paste', (event) => {
        //LoggerUtil.log(event);
        this.coreDataChannelService.sendMessageOnDataChannel({
          from: this.userContextService.username,
          to: this.userContextService.userToChat,
          type: AppConstants.REMOTE_CONTROL,
          eventType: AppConstants.REMOTE_ACCESS_HANDLER_IDS.PASTE,
          data: event.clipboardData.getData('Text')
        }, AppConstants.REMOTE_CONTROL);
      })
    );

    /**
     * register 'copy' event listener for remote access
     * 
     */
    this.talkWindowContextService.canvasUnlistenFunctions.push(
      this.renderer.listen(remoteVideoCanvas.nativeElement, 'copy', (event) => {
        //LoggerUtil.log(event);
        // this.webrtcService.sendMessageOnDataChannel({
        //   from: this.talkWindowContextService.username,
        //   to: this.talkWindowContextService.userToChat,
        //   type: AppConstants.REMOTE_CONTROL
        // }, AppConstants.REMOTE_CONTROL);
      })
    );
  }
}
