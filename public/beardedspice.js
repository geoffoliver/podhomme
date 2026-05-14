//
//  Podhomme.js
//  BeardedSpice
//
//  Copyright (c) 2015-2017 GPL v3 http://www.gnu.org/licenses/gpl.html
//

BSStrategy = {
  version: 1,
  displayName: "Podhomme",
  accepts: {
    method: "predicateOnTab",
    format: "%K LIKE[c] '*Podhomme*'",
    args: ["title"]
  },

  isPlaying: function () {
    var audio = document.querySelector('audio');
    return !!(audio && !audio.paused && audio.src);
  },

  toggle: function () {
    window.podhomme && window.podhomme.toggle();
  },

  previous: function () {
    window.podhomme && window.podhomme.skipBack();
  },

  next: function () {
    window.podhomme && window.podhomme.skipForward();
  },

  pause: function () {
    window.podhomme && window.podhomme.pause();
  },

  favorite: function () {
    window.podhomme && window.podhomme.favorite();
  },

  trackInfo: function () {
    var artworkEl = document.querySelector('[data-podhomme="artwork"]');
    var titleEl   = document.querySelector('[data-podhomme="episode-title"]');
    var albumEl   = document.querySelector('[data-podhomme="podcast-title"]');

    return {
      track:  titleEl   ? titleEl.innerText  : '',
      album:  albumEl   ? albumEl.innerText  : '',
      artist: albumEl   ? albumEl.innerText  : '',
      image:  artworkEl ? artworkEl.src      : '',
      favorited: false,
    };
  }
}
