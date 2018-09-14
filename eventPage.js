var timer;
chrome.runtime.onInstalled.addListener(function() {
    $.ajax({
        url: 'https://www.jelenacuka.com/coloranalysis2/getID.php',
        type: 'POST',
        data: {generiraj: "generateIdCode" },
        success: function (data) {
            chrome.storage.sync.set({'userId': data });
        },
        error: function (data) {
        }
    });
});
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    if(request.todo == "showPageAction"){
        chrome.tabs.query({active:true, currentWindow: true}, function(tabs){
            chrome.pageAction.show(tabs[0].id);
        });
    }
    if(request.todo == "startCollectingColors"){
        collectColorDataStart();//user opened facebook next call is after 20s
        //every 10 seconds collects color data->timer
        if(timer>0){
            clearInterval(timer);
            timer=0;
        }
        timer=setInterval(collectColorDataStart, 10000);
    }
});
function collectColorDataStart() {
    try{  
      getScreenshot();
    }catch(e){}
}
function getScreenshot(){
    chrome.tabs.captureVisibleTab(function(screenshotDataUrl) {
      if(screenshotDataUrl!=undefined){
        var canvas = document.createElement('canvas');
        var image = new Image();
        image.onload = function() {
            canvas.width = this.width;
            canvas.height = this.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(this, 0, 0);
            var imgData = ctx.getImageData(0, 0, this.width,this.height);
            var i;
            var currentDate = new Date();
            var getCurrentDate=currentDate.getFullYear()+"-"+(currentDate.getMonth()+1)+"-"+ currentDate.getDate()+ " "+currentDate.getHours() + ":" +currentDate.getMinutes() + ":" +currentDate.getSeconds() ;
            var dataToCollect={
                width: imgData.width,
                height: imgData.height,
                pixelcount: imgData.width*imgData.height,
                dateTime: getCurrentDate,
                pageColorsArray:[],
                specificColorsArray:[]
            }
            //Extra tracking facebook official colors + black in specificColorsArray
            //Source of colors rgb values: https://www.lockedownseo.com/social-media-colors/
            dataToCollect.specificColorsArray.push({r: 59,g:89,b:152,c:0});//FB1 fbblue1
            dataToCollect.specificColorsArray.push({r: 66,g:103,b:178,c:0});//FB2 fbblue2
            dataToCollect.specificColorsArray.push({r: 233,g:235,b:238,c:0});//FB3 fbgrey1
            dataToCollect.specificColorsArray.push({r: 54,g:88,b:153,c:0});//FB4 fbblue3
            dataToCollect.specificColorsArray.push({r: 246,g:247,b:249,c:0});//FB5 fbgrey2
            dataToCollect.specificColorsArray.push({r: 255,g:255,b:255,c:0});//wHITE fbwhite
            dataToCollect.specificColorsArray.push({r: 0,g:0,b:0,c:0});//BLACK fbblack

            dataToCollect.pageColorsArray.push({
                r: parseInt(imgData.data[0]*imgData.data[3]/255/51)*51,
                g: parseInt(imgData.data[1]*imgData.data[3]/255/51)*51,
                b: parseInt(imgData.data[2]*imgData.data[3]/255/51)*51,
                c: 1
            });
            for (i = 4; i < imgData.data.length; i += 4) {
                var alphaModified= imgData.data[i+3]/255;//alpha-opacity pixel component 0-255 converted to 0-1 space
                var addToEnd=true;
                for(var k=0;k<dataToCollect.pageColorsArray.length;k++){
                    if(//if color is already found increase its counter
                        (dataToCollect.pageColorsArray[k].r <= (imgData.data[i]*alphaModified) &&((imgData.data[i]*alphaModified) < (dataToCollect.pageColorsArray[k].r+51)) )
                        && (dataToCollect.pageColorsArray[k].g <= (imgData.data[i+1]*alphaModified) &&((imgData.data[i+1]*alphaModified) < (dataToCollect.pageColorsArray[k].g+51)) )
                        &&(dataToCollect.pageColorsArray[k].b <= (imgData.data[i+2]*alphaModified) &&((imgData.data[i+2]*alphaModified) < (dataToCollect.pageColorsArray[k].b+51)) )
                    ){
                            dataToCollect.pageColorsArray[k].c++;
                            addToEnd=false;
                            break;
                    }
                }
                if(addToEnd===true){//new color found on page //adding new color to dataToCollect.pageColorsArray
                        dataToCollect.pageColorsArray.push({
                            r: parseInt(imgData.data[i]*alphaModified/51)*51,
                            g:parseInt(imgData.data[i+1]*alphaModified/51)*51,
                            b:parseInt(imgData.data[i+2]*alphaModified/51)*51,
                            c:1
                        });
                        /*dataToCollect.pageColorsArray structure explanation
                        -each color component has six energy subclasses 256(0+255) divided with 51
                          -dividing color component with 51 and then rounding it to lower value and
                          -multiplying lower value with 51->energy class of subpixel is calculated
                          -example: 51,51,51 is 51,51,51 category, 52,150,223 is 51,102,204 category
                          
                          sub pixel energy classes:
                          0-50->0 subclass
                          51-101->51 subclass
                          102->152->102 subclass
                          153-203->153 subclass
                          204-254->204 subclass
                          255->255 subclass

                          Each component can be part of one of 6 energy subclasses.
                          Consequently,that makes total 216 energy classes

            */ 
                }
                /*additional monitoring specific colors if needed for analysis fb colors + white + black r+-1g+-1b+-1*/
                dataToCollect.specificColorsArray.forEach(function(color) {
                        if(
                            ( (color.r-1) <= (imgData.data[i]*alphaModified) &&((imgData.data[i]*alphaModified) < (color.r+1)) )
                            && ( (color.g-1) <= (imgData.data[i+1]*alphaModified) &&((imgData.data[i+1]*alphaModified) < (color.g+1)) )
                            &&( (color.b-1) <= (imgData.data[i+2]*alphaModified) &&((imgData.data[i+2]*alphaModified) < (color.b+1)) )
                            ){
                                color.c++;
                            }
                });
            }
            //console.log(dataToCollect);
            chrome.storage.sync.get('userId',function(userInfo){
                if(userInfo.userId){
                    dataToCollect.userid=userInfo.userId;
                    $.ajax({
                        url: 'https://www.jelenacuka.com/coloranalysis2/insertDataP.php',
                        type: 'POST',
                        data: dataToCollect,
                        success: function (data) {
                        },
                        error: function (data) {
                        }
                    });
                }
            });
        };
        image.src = screenshotDataUrl;
      }
    });
}
