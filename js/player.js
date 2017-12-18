/**
 * HTML5 Audio Visualizer Player
 * HTML5音乐可视化播放器
 * 版本号:1.1.2
 * Author：PoppinRubo
 * License: MIT
 */

//创建一个对象方法
function Player() {
    //播放获取进度信息时间计时器
    var timer;
    //加载超时计时
    var overtime;
    //先把自己用变量储存起来,后面要用
    var Myself = this;
    //默认设置
    Myself.button = { //设置生成的控制按钮,默认开启
        prev: true, //上一首
        play: true, //播放,暂停
        next: true, //下一首
        volume: true, //音量
        progressControl: true //进度控制
    }
    Myself.analyser = null;
    //定义事件默认空方法
    Myself.event = function (e) {
        //未设置事件方法就默认执行空方法
    }
    //频谱配置,外部调用就开始进行处理
    this.config = function (Object) {
        Myself.playList = Object.playList;
        Myself.canvasId = Object.canvasId;
        Myself.autoPlay = Object.autoPlay;
        Myself.event = Object.event == null ? Myself.event : Object.event;
        Myself.button = Object.button == null ? Myself.button : Object.button;
        Myself.effect = Object.effect == null ? -1 : Object.effect; //默认随机,效果为-1表示随机切换效果
        //记录是否处理过音频,保证createMediaElementSource只创建一次,多次创建会出现错误
        Myself.handle = 0;
        createParts();
    }

    //实例化一个音频类型window.AudioContext
    function windowAudioContext() {
        //下面这些是为了统一Chrome和Firefox的AudioContext
        window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
        window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
        window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame;
        try {
            Myself.audioContext = new AudioContext();
        } catch (e) {
            console.log('您的浏览器不支持 AudioContext,信息:' + e);
        }
    }

    //创建播放部件
    function createParts() {
        //创建audio
        var audio = document.createElement("AUDIO");
        var player = document.getElementById("player");
        player.appendChild(audio);
        Myself.audio = audio;
        //创建控制按钮
        var control = document.getElementById("playerControl");
        var button = Myself.button;

        if (button.prev) {
            //上一首,按钮创建
            var prevBtn = document.createElement('i');
            prevBtn.className = "icon-previous";
            prevBtn.id = "playPrev";
            prevBtn.title = "上一首";
            prevBtn.innerHTML = "&#xea23;";
            control.appendChild(prevBtn);
            //上一首,控制
            var playPrev = document.getElementById("playPrev");
            playPrev.onclick = function () {
                prev();
            }
        }
        if (button.play) {
            //播放,暂停,按钮创建
            var playBtn = document.createElement('i');
            playBtn.className = "icon-play";
            playBtn.id = "playControl";
            playBtn.title = "播放";
            playBtn.innerHTML = "&#xea1c;";
            playBtn.setAttribute('data', 'pause');
            control.appendChild(playBtn);
            //播放,暂停,控制
            var playControl = document.getElementById("playControl");
            playControl.onclick = function () {
                play();
            }
        }
        if (button.next) {
            //下一首,按钮创建
            var nextBtn = document.createElement('i');
            nextBtn.className = "icon-next";
            nextBtn.id = "playNext";
            nextBtn.title = "下一首";
            nextBtn.innerHTML = "&#xea24;";
            control.appendChild(nextBtn);
            //下一首,控制
            var playNext = document.getElementById("playNext");
            playNext.onclick = function () {
                next();
            }
        }
        if (button.volume) {
            //按钮与音量控制条容器
            var volumeBox = document.createElement('div');
            volumeBox.id = "volumeBox";
            control.appendChild(volumeBox);
            //音量,按钮创建
            var volumeBtn = document.createElement('i');
            volumeBtn.className = "icon-volume";
            volumeBtn.id = "playVolume";
            volumeBtn.title = "音量";
            playBtn.setAttribute('data', 'normal');
            volumeBtn.innerHTML = "&#xea27;";
            volumeBox.appendChild(volumeBtn);
            //音量控制条
            var volumeBar = document.createElement('div');
            volumeBar.id = "volumeBar";
            volumeBox.appendChild(volumeBar);

            var volumeSize = document.createElement('div');
            volumeSize.id = "volumeSize";
            volumeBar.appendChild(volumeSize);

            volumeBar.onclick = function (event) {
                volumeChange(event, volumeBar, volumeSize);
            }

            //音量,点击控制,静音-恢复
            var volumeBtn = document.getElementById("playVolume");
            volumeBtn.onclick = function () {
                volume();
            }
        }

        //显示时间容器
        var playerTime = document.getElementById("playerTime");
        playerTime.innerHTML = "-&nbsp;00:00&nbsp;/&nbsp;00:00&nbsp;&nbsp;&nbsp;&nbsp;0%";
        Myself.playerTime = playerTime;

        //进度条
        if (Myself.button.progressControl) {
            var progress = document.getElementById("progress");
            progress.style.cursor = "pointer";
            progress.onclick = function (event) {
                progressControl(event, progress);
            }
        }

        //调用实例化AudioContext
        windowAudioContext();

        //加载地址方法,audio加入一个初始地址
        var playList = Myself.playList;
        //把列表第一个mp3地址设置到audio上
        Myself.audio.src = playList[0].mp3;

        //歌曲信息,创建
        var songInfo = document.getElementById('songInfo');

        var songTitle = document.createElement('div');
        songTitle.id = "songTitle";
        songInfo.appendChild(songTitle);

        var album = document.createElement('div');
        album.id = "album";
        songInfo.appendChild(album);

        var span = document.createElement('span');
        span.innerHTML = "-";
        songInfo.appendChild(span);

        var artist = document.createElement('div');
        artist.id = "artist";
        songInfo.appendChild(artist);

        //记录当前播放在数组里的位置
        Myself.nowPlay = 0;
        //信息设置
        updates();
        //获取存储音量
        Myself.audio.volume = volumeGetCookie();
        //设置自动播放,开始播放
        if (Myself.autoPlay) {
            play();
        }
    }

    //播放,暂停 控制
    function play() {
        if (Myself.button.play) { //判断是否设置播放按钮
            var playBtn = document.getElementById("playControl");
            var data = playBtn.getAttribute("data");
        }
        //播放控制
        if (Myself.audio.paused) {
            Myself.audio.play();
            //字符图标变化
            playBtn.setAttribute("data", "play");
            playBtn.title = "暂停";
            playBtn.innerHTML = "&#xea1d;";

            timer = setInterval(function () {
                //显示时长
                showTime();
                //获取就绪状态并处理相应
                playerState();
            }, 1000);
            //播放媒体信息更新
            updates();
            //处理播放数据,处理过就不再处理
            if (Myself.handle == 0) {
                playHandle();
            }
        } else {
            Myself.audio.pause();
            //字符图标变化
            playBtn.setAttribute("data", "pause");
            playBtn.title = "播放";
            playBtn.innerHTML = "&#xea1c;";

            window.clearInterval(timer);
        }
        //事件传出
        Myself.event({
            eventType: "play",
            describe: "播放/暂停"
        });
    }

    //播放媒体信息更新
    function updates() {
        var List = Myself.playList;
        var nowPlay = Myself.nowPlay;
        var songTitle = document.getElementById("songTitle");
        songTitle.innerHTML = List[nowPlay].title;
        songTitle.title = "歌曲:" + List[nowPlay].title;
        var songAlbum = document.getElementById("album");
        songAlbum.innerHTML = "(" + List[nowPlay].album + ")";
        songAlbum.title = "所属专辑:" + List[nowPlay].album;
        var songArtist = document.getElementById("artist");
        songArtist.innerHTML = List[nowPlay].artist;
        songArtist.title = "艺术家:" + List[nowPlay].artist;
    }

    //音频播放状态,做消息处理
    function playerState() {
        //音频当前的就绪状态, 0 未连接 1 打开连接 2 发送请求 3 交互 4 完成交互,接手响应
        var state = Myself.audio.readyState;
        var playerState = document.getElementById("playerState");
        var songInfo = document.getElementById("songInfo");
        if (state == 4) {
            if (playerState != null) {
                songInfo.removeChild(playerState);
                //清除超时计时
                window.clearTimeout(overtime);
            }
        } else {
            if (playerState == null) {
                playerState = document.createElement("div");
                playerState.id = "playerState";
                playerState.innerHTML = "<i class='icon-music'>&#xe911;</i>加载中……";
                songInfo.appendChild(playerState);
                //加载超时处理
                overtime = setTimeout(function () { //2分钟后超时处理
                    if (Myself.audio.readyState == 0) {
                        playerState.innerHTML = "加载失败!"
                    }
                }, 120000)
            }
        }
    }

    //显示时长,进度
    function showTime() {
        if (Myself.audio.readyState == 4) {
            //时长总量
            var duration = Myself.audio.duration;
            //时长进度
            var currentTime = Myself.audio.currentTime;
            //剩余量
            var surplusTime = duration - currentTime;
            var ratio = ((currentTime / duration) * 100).toFixed(1);
            //将100.00%变为100%
            ratio = ratio == 100.0 ? 100 : ratio;

            function timeFormat(t) {
                return Math.floor(t / 60) + ":" + (t % 60 / 100).toFixed(2).slice(-2);
            }

            Myself.playerTime.innerHTML = "-&nbsp;" + timeFormat(surplusTime) + "&nbsp;/&nbsp;" + timeFormat(duration) + "&nbsp;&nbsp;&nbsp;&nbsp;" + ratio + "%";
            document.getElementById("playerProgressBar").style.width = ratio + "%";
            if (ratio == 100) { //播放结束就播放就调用下一首
                next();
            }

        } else { //状态不为4说明未就绪显示00:00
            Myself.playerTime.innerHTML = "-&nbsp;00:00&nbsp;/&nbsp;00:00&nbsp;&nbsp;&nbsp;&nbsp;0%";
        }


    }

    //播放上一首
    function prev() {
        //数组播放最前移动到最后
        if (Myself.nowPlay == 0) {
            Myself.nowPlay = Myself.playList.length;
        }
        //记录当前播放在数组里的位置位置移动,减小
        Myself.nowPlay = Myself.nowPlay - 1;
        //媒体url信息更新
        Myself.audio.src = Myself.playList[Myself.nowPlay].mp3;
        //先清除计时避免越点计时越快
        window.clearInterval(timer);
        //重绘,变换效果
        if (Myself.analyser != null) {
            drawSpectrum(Myself.analyser);
        }
        //事件传出
        Myself.event({
            eventType: "prev",
            describe: "播放上一首"
        });
        play();
    }

    //播放下一首
    function next() {
        //数组播放最后移动到最前
        if (Myself.nowPlay == Myself.playList.length - 1) {
            Myself.nowPlay = -1;
        }
        //记录当前播放在数组里的位置位置移动,增加
        Myself.nowPlay = Myself.nowPlay + 1;
        //媒体url信息更新
        Myself.audio.src = Myself.playList[Myself.nowPlay].mp3;
        //先清除计时避免越点计时越快
        window.clearInterval(timer);
        //重绘,变换效果
        if (Myself.analyser != null) {
            drawSpectrum(Myself.analyser);
        }
        //事件传出
        Myself.event({
            eventType: "next",
            describe: "播放上一首"
        });
        play();
    }

    //音量点击控制,静音-恢复
    function volume() {
        if (Myself.button.volume) { //判断是否设置音量按钮
            var volumeBtn = document.getElementById("playVolume");
            var data = volumeBtn.getAttribute("data");
            //字符图标变化
            if (data == "normal") {
                volumeBtn.setAttribute("data", "mute");
                volumeBtn.innerHTML = "&#xea27;";
            } else {
                volumeBtn.setAttribute("data", "normal");
                volumeBtn.innerHTML = "&#xea2a;"
            }
        }
        //点击音量控制
        if (Myself.audio.muted) {
            Myself.audio.muted = false;
        } else {
            Myself.audio.muted = true;
        }
    }

    //音量控制条点击设置音量大小
    function volumeChange(e, volumeBar, volumeSize) {
        //点击的位置
        var offsetX = e.offsetX;
        //获取音量条总高度
        var width = volumeBar.offsetWidth;
        //算出占比
        var proportion = offsetX / width;
        volumeSize.style.width = (proportion * 100) + "%";
        var size = proportion;
        //音量设置
        Myself.audio.volume = size;
        //音量cookie存储
        volumeSetCookie(size);
    }

    //音量cookie设置
    function volumeSetCookie(size) {
        var d = new Date();
        d.setHours(d.getHours() + (24 * 30)); //保存一个月
        document.cookie = "playerVolume=" + size + ";expires=" + d.toGMTString();
    }

    //音量cookie获取
    function volumeGetCookie() {
        var volumeSize = document.getElementById("volumeSize");
        var arr, reg = new RegExp("(^| )playerVolume=([^;]*)(;|$)");
        var volume = 1;
        if (arr = document.cookie.match(reg)) {
            volume = unescape(arr[2]);
        } else {
            volume = 0.5;
        }
        volumeSize.style.width = volume * 100 + "%";
        return volume;
    }

    //进度点击控制
    function progressControl(e, progress) {
        //点击的位置
        var offsetX = e.offsetX;
        //获取进度条总长度
        var width = progress.offsetWidth;
        //算出占比
        var proportion = offsetX / width;
        //把宽的比例换为播放比例,再计算audio播放位置
        var duration = Myself.audio.duration;
        var playTime = duration * proportion;
        //从此处播放
        Myself.audio.currentTime = playTime;

    }

    //播放处理,提取数据
    function playHandle() {
        windowAudioContext();
        var audioContext = Myself.audioContext;
        var analyser = audioContext.createAnalyser();
        var playData = audioContext.createMediaElementSource(Myself.audio);
        // 将播放数据与分析器连接
        playData.connect(analyser);
        analyser.connect(audioContext.destination);
        //接下来把分析器传出去创建频谱
        drawSpectrum(analyser);
        //记录一下,还会用到analyser
        Myself.analyser = analyser;
        Myself.handle = 1;
    }

    //频谱效果处理
    function drawSpectrum(analyser) {
        //颜色数组
        var colorArray = ['#f82466', '#00FFFF', '#AFFF7C', '#FFAA6A', '#6AD5FF', '#D26AFF', '#FF6AE6', '#FF6AB8', '#FF6A6A', "#7091FF"];
        //颜色随机数
        var colorRandom = Math.floor(Math.random() * colorArray.length);
        //随机选取颜色
        Myself.color = colorArray[colorRandom];
        //效果随机数
        var effectRandom = Math.floor(Math.random() * 2);
        if (Myself.effect != -1) {
            effectRandom = Myself.effect;
        }
        //随机选取效果
        switch (effectRandom) {
            case 0:
                //条形
                bar(analyser);
                break;
            case 1:
                //环形声波
                circular(analyser);
                break;
            default:
                //条形
                bar(analyser);
        }

    }

    //16进制颜色转为RGB格式,传入16进制颜色代码与透明度
    function colorRgb(color, opacity) {
        var reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/; //十六进制颜色值的正则表达式
        opacity = opacity < 0 ? 0 : opacity; //颜色范围控制
        opacity = opacity > 1 ? 1 : opacity;
        if (color && reg.test(color)) {
            if (color.length === 4) {
                var sColorNew = "#";
                for (var i = 1; i < 4; i += 1) {
                    sColorNew += color.slice(i, i + 1).concat(color.slice(i, i + 1));
                }
                color = sColorNew;
            }
            //处理六位的颜色值
            var sColorChange = [];
            for (var i = 1; i < 7; i += 2) {
                sColorChange.push(parseInt("0x" + color.slice(i, i + 2)));
            }
            return "rgba(" + sColorChange.join(",") + "," + opacity + ")";
        } else {
            return color;
        }
    }

    //条状效果
    function bar(analyser) {
        var canvas = document.getElementById(Myself.canvasId),
            cwidth = canvas.width,
            cheight = canvas.height - 2,
            meterWidth = 10, //频谱条宽度
            capHeight = 2,
            capStyle = '#FFFFFF',
            meterNum = 1000 / (10 + 2), //频谱条数量
            ctx = canvas.getContext('2d'),
            capYPositionArray = [], //将上一画面各帽头的位置保存到这个数组
            gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(1, Myself.color);
        var drawMeter = function () {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            var step = Math.round(array.length / meterNum); //计算采样步长
            ctx.clearRect(0, 0, cwidth, cheight);
            for (var i = 0; i < meterNum; i++) {
                var value = array[i * step]; //获取当前能量值
                //把能量用事件传出
                Myself.event({
                    eventType: "energy",
                    describe: value
                });
                if (capYPositionArray.length < Math.round(meterNum)) {
                    capYPositionArray.push(value); //初始化保存帽头位置的数组，将第一个画面的数据压入其中
                };
                ctx.fillStyle = capStyle;
                //开始绘制帽头
                if (value < capYPositionArray[i]) { //如果当前值小于之前值
                    ctx.fillRect(i * 12, cheight - (--capYPositionArray[i]), meterWidth, capHeight); //则使用前一次保存的值来绘制帽头
                } else {
                    ctx.fillRect(i * 12, cheight - value, meterWidth, capHeight); //否则使用当前值直接绘制
                    capYPositionArray[i] = value;
                };
                //开始绘制频谱条
                ctx.fillStyle = gradient;
                ctx.fillRect(i * 12, cheight - value + capHeight, meterWidth, cheight);
            }
            requestAnimationFrame(drawMeter);
        }
        requestAnimationFrame(drawMeter);
    }

    //环形声波
    function circular(analyser) {
        var canvas = document.getElementById(Myself.canvasId),
            width = canvas.width,
            height = canvas.height,
            ctx = canvas.getContext('2d');
        var draw = function () {
            var array = new Uint8Array(128); //长度为128无符号数组用于保存getByteFrequencyData返回的频域数据
            analyser.getByteFrequencyData(array); //以下是根据频率数据画图
            ctx.clearRect(0, 0, width, height); //清除画布
            for (var i = 0; i < (array.length); i++) {
                var value = array[i];
                ctx.beginPath();
                ctx.arc(width / 2, height / 2, value * 0.8, 0, 400, false);
                ctx.lineWidth = 2; //线圈粗细
                ctx.strokeStyle = (1, colorRgb(Myself.color, value / 1000)); //颜色透明度随值变化
                ctx.stroke(); //画空心圆
                ctx.closePath();
                //把能量用事件传出
                Myself.event({
                    eventType: "energy",
                    describe: value
                });
            }
            requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
    }


}