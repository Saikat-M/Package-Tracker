const video = document.getElementById('webcam');
const liveView = document.getElementById('liveView');
const demosSection = document.getElementById('demos');
const enableWebcamButton = document.getElementById('webcamButton');
const SlackAPI = "https://hooks.slack.com/services/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"
//For Snapshot
// Get the canvas and obtain a context for
// drawing in it
canvas = document.getElementById("myCanvas");
ctx = canvas.getContext('2d');
itemToMonitor = 'Amazon'
let noOfDetectedObjects = 0
let ItemofInterest = []
let lastCountedItems = 0
let noOfPackage = 0

// Check if webcam access is supported.
function getUserMediaSupported() {
    return !!(navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia);
  }
  
  // If webcam supported, add event listener to button for when user
  // wants to activate it to call enableCam function which we will 
  // define in the next step.
  if (getUserMediaSupported()) {
    enableWebcamButton.addEventListener('click', enableCam);
  } else {
    console.warn('getUserMedia() is not supported by your browser');
  }
  
  // Enable the live webcam view and start classification.
function enableCam(event) {
    // Only continue if the COCO-SSD has finished loading.
    if (!model) {
      return;
    }
    
    // Hide the button once clicked.
    event.target.classList.add('removed');  
    
    // getUsermedia parameters to force video but not audio.
    const constraints = {
      video: true
    };
  
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
      video.srcObject = stream;
      video.addEventListener('loadeddata', predictWebcam);
    });
  }

  // Store the resulting model in the global scope of our app.
var model = undefined;
var children = [];

// Loading Machine Learning Mode Takes time so should wait for proper flow of work
tf.automl.loadObjectDetection('/model/model.json').then(function (loadedModel) {
  model = loadedModel;
  // Show demo section now model is ready to use.
  demosSection.classList.remove('invisible');
});


function predictWebcam() {
  // Now let's start classifying a frame in the stream.
  const options = {score: 0.5, iou: 0.5, topk: 20};
  model.detect(video,options).then(function (predictions) {
    // Remove any highlighting we did previous frame.
    for (let i = 0; i < children.length; i++) {
      liveView.removeChild(children[i]);
    }
    children.splice(0);
    
    // Now lets loop through predictions and draw them to the live view if
    // they have a high confidence score.
    console.log(predictions)
    for (let n = 0; n < predictions.length; n++) {
      // If we are over 70% sure we are sure we classified it right, draw it!
      if (predictions[n].label === itemToMonitor && predictions[n].score > 0.75) {
        drawrectagle(predictions[n],n)
        if (predictions.length > noOfDetectedObjects){
          noOfDetectedObjects = predictions.length
          ItemofInterest.push(predictions[n])

          // Draws current image from the video element into the canvas
          drawOnCanvas(n,ItemofInterest)
        }
      }
    }
    
    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
  });

  drawrectagle = (detectedObj,n) => {
    const p = document.createElement('p');
        p.innerText = detectedObj.label + ' Package ' + (n+1).toString() + ' - with ' 
            + Math.round(parseFloat(detectedObj.score) * 100) 
            + '% confidence.';
        p.style = 'margin-left: ' + detectedObj.box['left'] + 'px; margin-top: '
            + (detectedObj.box['top'] - 10) + 'px; width: ' 
            + (detectedObj.box['width'] - 10) + 'px; top: 0; left: 0;';

        const highlighter = document.createElement('div');
        highlighter.setAttribute('class', 'highlighter');
        highlighter.style = 'left: ' + detectedObj.box['left'] + 'px; top: '
            + detectedObj.box['top'] + 'px; width: ' 
            + detectedObj.box['width'] + 'px; height: '
            + detectedObj.box['height'] + 'px;';

        liveView.appendChild(highlighter);
        liveView.appendChild(p);
        children.push(highlighter);
        children.push(p);
  }

  drawOnCanvas = (noOfObj,ItemofInterest) => {
    ctx.drawImage(video, 0,0, canvas.width, canvas.height);
    // capture image when detect cup
    var capturedImage = new Image()
    capturedImage.id = 'Package_'+ (noOfObj+1).toString()
    capturedImage.src = canvas.toDataURL('image/png')
    // console.log('capturedImage',capturedImage)
    // Functions to count no of packages
    noOfPackagesPresent(ItemofInterest,capturedImage)
  }

  noOfPackagesPresent = (ItemofInterest,latestCapturedImage) => {
    console.log('lastCountedItems',lastCountedItems)
    console.log('ItemofInterest length',ItemofInterest.length)
    if (ItemofInterest.length > lastCountedItems){
      lastCountedItems = ItemofInterest.length
      // Function to upload image to FireBase
      uploadImage(latestCapturedImage)
    }
  }

  uploadImage = (capturedImage) => {
    noOfPackage++  
    const ref = firebase.storage().ref();
    ref.child(new Date() + '-' + 'base64').putString(capturedImage.src, 'data_url').then(snapshot => snapshot.ref.getDownloadURL())
    .then(url => {
      // Function to send alert in Slack
      slackIt(url,noOfPackage)
    })
    .catch(console.error);
  }

  slackIt = (url) => {
    console.log(url)
        let blockPayload = {
          "blocks": [
            {
              "type": "image",
              "title": {
                "type": "plain_text",
                "text": "No of Packages: "+noOfPackage.toString()
              },
              "block_id": "image",
              "image_url": url,
              "alt_text": "No of Packages: "+noOfPackage.toString()
            }
          ]
        }
        fetch(
          SlackAPI,
            {   method: "POST",
                // headers: {"Content-type" : "application/json"},
                body: JSON.stringify(blockPayload)
            }).then((res) => {
                console.log(res)
                if (res.ok) {
                  alert("Check Slack")
                }
            });
  }

}