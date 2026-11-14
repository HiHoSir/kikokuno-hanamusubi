// The title page opens this route. Playback must remain audible on iPhone Safari,
// so we never force mute to bypass its user-gesture restrictions.
const video = document.querySelector('#opening-video');
const overlay = document.querySelector('#play-overlay');
const playButton = document.querySelector('#play-opening');
const message = document.querySelector('#playback-message');
const skipButton = document.querySelector('#skip-opening');
const gameUrl = new URL('../game/', document.baseURI);
let navigating = false;
const portrait=matchMedia('(orientation: portrait)');
let resumeAfterRotation=false;

function enterVillage() {
  if (navigating) return;
  navigating = true;
  window.KIKOKU_ROUTE.go(gameUrl.href);
}

function showPlayButton(text) {
  overlay.hidden = false;
  message.textContent = text;
}

function hidePlayButton() {
  overlay.hidden = true;
}

async function playOpening() {
  if(portrait.matches){resumeAfterRotation=true;return;}
  resumeAfterRotation=false;
  try {
    if (video.error) video.load();
    await video.play();
    hidePlayButton();
  } catch (error) {
    // Audio autoplay commonly needs one more tap after a page navigation on iOS.
    showPlayButton('音声付きで再生するには「オープニングを再生」を押してください。');
  }
}

// Safari does not reliably support programmatic rotation lock. Pause the movie
// while the device is upright; a turn to landscape continues at the same time.
function orientationChanged(){
  if(portrait.matches){
    if(!video.paused){resumeAfterRotation=true;video.pause();}
  }else if(resumeAfterRotation){void playOpening();}
}
portrait.addEventListener?.('change',orientationChanged);
playButton.addEventListener('click', playOpening);
skipButton.addEventListener('click', enterVillage);
video.addEventListener('playing', hidePlayButton);
video.addEventListener('ended', enterVillage);
video.addEventListener('error', () => {
  showPlayButton('動画を読み込めません。再試行するか、鬼灯村へ進んでください。');
});

// Attempt immediate playback where the browser permits it; otherwise show
// a real user-gesture control without silently muting the soundtrack.
playOpening();
