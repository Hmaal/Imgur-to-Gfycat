var request = superagent;
var gfyEndpoints = {
  transcode: 'http://upload.gfycat.com/transcode/',
  transcodeRelease: 'http://upload.gfycat.com/transcodeRelease/',
  status: 'http://gfycat.com/cajax/get/',
  checkURL: 'http://gfycat.com/cajax/checkUrl/',
  fetch: 'http://gfycat.com/fetch/',
  home: 'http://gfycat.com/'
};
var gifRegex = /.*imgur.com\/.*\.gif(?:\?.*)?$/;
var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);
var slice = Array.prototype.slice.call.bind(Array.prototype.slice);

function init(){
  embedGfyCat();
  attachMutationObservers();
  scan();
}

function scan(element){
  if (!element) element = document;
  // Allow elements, docs, and doc fragments. Others are ignored.
  if ([1, 9, 11].indexOf(element.nodeType) === -1 ) return;
  var imgs = element.getElementsByTagName('img');
  var anchors = element.querySelectorAll('a[href*=".gif"]');

  for (var i = 0; i < imgs.length; i++){
    replaceGif(imgs[i]);
  }

  for (i = 0; i < anchors.length; i++){
    replaceAnchor(anchors[i]);
  }
}

// Listen to the page to catch any new anchors or images to convert.
function attachMutationObservers(){
  var observer = new WebKitMutationObserver(function(mutations) {
    mutations.forEach(function(m){
      forEach(m.addedNodes, scan);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Replacing a gif on the page is a little more complex. We need to send the fetch
// request to gfycat so it can create and convert the file. When it finishes, it will redirect
// to the gfycat link so we can embed into the page.
function replaceGif(imgNode){
  if (!isImgurGif(imgNode.src)) return;

  // If this contains a fetch url (RES creates images from anchors), remove it
  if (imgNode.src.indexOf(gfyEndpoints.fetch) !== -1){
    imgNode.src = imgNode.src.replace(gfyEndpoints.fetch, '');
  }

  var parent = imgNode.parentNode;
  imgNode.style.display = 'none'; // hide while we are waiting for gfycat

  // url, cb, errorCb
  getGfyUrl(imgNode.src, replaceGifWithGfy, revert);

  function replaceGifWithGfy(id){
    // Remove the image and replace with the gfycat stub so gfycat's js can handle it.
    parent.removeChild(imgNode);

    // Remove any RES placeholders nearby.
    var RESPlaceholders = parent.getElementsByClassName('RESImagePlaceholder');
    forEach(RESPlaceholders, parent.removeChild.bind(parent));

    // Create gfy img tag, which will be picked up by their js.
    var gfyImg = document.createElement('img');
    gfyImg.setAttribute('class', 'gfyitem');
    gfyImg.setAttribute('data-id', id);
    parent.appendChild(gfyImg);

    // Update any anchors to the new gfy url. Replace those prepended with /fetch/ and without.
    [gfyEndpoints.fetch + imgNode.src, imgNode.src].forEach(function(src){
      var anchors = document.querySelectorAll('a[href="' + src + '"]');
      forEach(anchors, function(a){
        if (a.href === src) a.href = gfyEndpoints.home + id;
      });
    });

    runGfyCat();
  }

  function revert(err){
    // Just show the old gif.
    imgNode.style.display = '';
    imgNode.src += '?ignoreGfy'; // allow us through webRequest blocker
  }
}

// Replace an anchor link with a link to gfycat's fetch endpoint.
function replaceAnchor(anchorNode){
  if (!isImgurGif(anchorNode.href)) return;
  if (anchorNode.getAttribute('data-gyffied')) return;
  if (anchorNode.href.indexOf(gfyEndpoints.fetch) !== -1) return;
  anchorNode.href = gfyEndpoints.fetch + anchorNode.href;
  anchorNode.setAttribute('data-gyffied', true);
}

function isImgurGif(url){
  return gifRegex.test(url);
}

// Run /transcodeRelease to get the gfyURL. If the gfy exists, it will immediately be returned
// and everybody's happy. Otherwise, we return an error which will replace the gif. The image will be transcoded
// in the background for the next user.
function getGfyUrl(url, cb, errorCb){
  var endpoint = gfyEndpoints.transcodeRelease + randomString() + '?fetchUrl=' + encodeURI(url);
  request.get(gfyEndpoints.transcodeRelease + randomString())
    .query({fetchUrl: url})
    .end(function(err, res){
      if (err) return errorCb(err);
      if (res.body.gfyName) cb(res.body.gfyName);
      else errorCb(new Error('Transcode in progress'));
    });
}

// Embed gfycat into the page.
function embedGfyCat(){
  // Skip if this has already been done
  if (document.getElementById('gfycatjs')) return;
  var script = document.createElement('script');
  script.src = chrome.extension.getURL('gfyembed.js');
  script.id = 'gfycatjs';
  (document.body || document.head || document.documentElement).appendChild(script);
}

// Run gfycat's init() function, which will find all convertable images and convert them.
function runGfyCat(){
  var script = document.createElement('script');
  script.type = 'text/javascript';
  var script_innards = document.createTextNode('window.gfyCollection.init();');
  script.appendChild(script_innards);
  (document.body || document.head || document.documentElement).appendChild(script);
}

function randomString(){
  var c = '';
  var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var b = 0; b < 10; b++) {
      c += a.charAt(Math.floor(Math.random() * a.length));
  }
  return c;
}

// Kickoff
init();
