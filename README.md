![](./src/assets/images/icons/app-icon.png)

# `theinstashare-web`
This is the web version of TheInstashare app which is a free peer to peer media streaming service built on top of WebRTC tech stack. Every feature is powered by the underlying peer to peer streaming capabilities provided by WebRTC stack. Product is still very much under active development.

### Try web version at - https://theinstashare.com/

Currently, it supports the following features -

### Major Features - 
- Text Chat
- Audio Chat
- Video Chat
- Screen Sharing
- File Sharing
- Remote Access (can only access remote machine)

NOTE - For sharing remote access of your machine use desktop version of TheInstashare app.

```
https://github.com/gaurav10610/theinstashare-desktop
```

### Minor Features - 
- Flip Camera
- Do not disturb
- Mute
- Full-Screen Mode
- Shared Media Download
- Automatic reconnection attempt

### Important points - 
- TheInstashare app uses opinionated one webrtc connection per media track approach while streaming media tracks.
- All the newly created webrtc connections will get closed as soon as user choose to stop media streaming.
- Text messages exchange, file transfer and streaming of remote access events(relaying of mouse and keyboard events) is powered by webrtc data channels.
- Idle webrtc datachannels will automatically get cleaned up along with webrtc connections by a recurring job if there is no exchange of information via datachannel from certain configured time.

### Steps to build the app -
``` 
npm install
ng build --prod 
```

### Features working status - 

| Features      | Windows       | Android  | IOS | Mac |
|:------------- |:-------------:|:--------:|:-------------:|:-----:|
| Text Chat | Yes | Yes | Yes | Yes |
| Audio Chat | Yes | Yes | | Yes |
| Video Chat | Yes | Yes | | Yes |
| Screen Sharing | Yes | NA | NA | |
| File Transfer | Yes | Yes | Yes | Yes |
| Access Remote Machine | Yes | Yes | Yes | Yes |

#### NOTE - All tests has been carried out using chrome browser.

### Screenshots -

![](./markdown-images/login.png)

![](./markdown-images/screen.png) 
 
![](./markdown-images/screen-sharing.jpg)

![](./markdown-images/video.jpg)

![](./markdown-images/text-screen.png)

### Author - 
Gaurav Kumar Yadav

Email - gaurav10610@gmail.com

Linkedin - https://www.linkedin.com/in/gaurav-kumar-yadav-6125817a/