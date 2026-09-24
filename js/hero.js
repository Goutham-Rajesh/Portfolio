/* ------------------------------------------------------------------
   Interactive hero
   - Three horizontal pointer zones (left / center / right) select a
     reaction. The character never follows the cursor.
   - Frame crossfades are driven by requestAnimationFrame with eased
     interpolation; the loop only runs while something is animating.
   - Zero framework, zero re-renders: DOM writes happen only when a
     value actually changes.
------------------------------------------------------------------- */
(function () {
  "use strict";

  var hero = document.getElementById("hero");
  var stage = document.getElementById("stage");
  var character = document.getElementById("character");
  var messageEl = document.getElementById("message");
  if (!hero || !stage || !character || !messageEl) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobileQuery = window.matchMedia(
    "(max-width: 767px), (hover: none) and (pointer: coarse) and (max-width: 1024px)"
  );

  /* ---------------- frames ---------------- */
  var frames = {};
  Array.prototype.forEach.call(character.querySelectorAll(".frame"), function (img) {
    frames[img.dataset.frame] = img;
  });

  var FADE_MS = reduceMotion ? 0 : 420;
  var HOLD_SIDE_MS = 2500;

  /* Greeting timeline: [frame, holdMs, message]  */
  var GREETING = [
    ["excited", 800, "Hey, it's you!"],
    ["headset-off", 900, "Hey, it's you!"],
    ["wave", 1500, "Hiiii!"],
    ["point", 2200, "Check out the portfolio"]
  ];

  /* ---------------- crossfade engine ---------------- */
  var current = "working"; // frame currently fully shown
  var incoming = null; // frame fading in on top
  var fadeStart = 0;
  var rafId = 0;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setOpacity(img, v) {
    // Avoid redundant style writes.
    var s = v.toFixed(3);
    if (img.__op !== s) {
      img.__op = s;
      img.style.opacity = s;
    }
  }

  function showFrame(name) {
    if (!frames[name] || name === current && !incoming) return;
    if (name === current && incoming) {
      // Reversing mid-fade: swap roles so we fade back smoothly.
      var tmp = incoming;
      incoming = null;
      setOpacity(frames[tmp], 0);
      frames[tmp].style.zIndex = "";
      return;
    }
    if (FADE_MS === 0) {
      setOpacity(frames[current], 0);
      setOpacity(frames[name], 1);
      current = name;
      return;
    }
    if (incoming && incoming !== name) {
      // Commit the in-progress incoming frame immediately, then fade to the new one.
      setOpacity(frames[incoming], 1);
      setOpacity(frames[current], 0);
      frames[current].style.zIndex = "";
      current = incoming;
      incoming = null;
    }
    incoming = name;
    fadeStart = performance.now();
    frames[incoming].style.zIndex = "2";
    setOpacity(frames[incoming], 0);
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    rafId = 0;
    if (!incoming) return;
    var t = Math.min(1, (now - fadeStart) / FADE_MS);
    var e = easeInOutCubic(t);
    // Incoming fades in over the outgoing frame; the outgoing stays fully
    // opaque underneath so the background never shows through mid-fade.
    setOpacity(frames[incoming], e);
    if (t >= 1) {
      setOpacity(frames[current], 0);
      frames[current].style.zIndex = "";
      frames[incoming].style.zIndex = "";
      current = incoming;
      incoming = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  /* ---------------- message ---------------- */
  var messageText = "";
  var messageSide = "";
  var messageHideTimer = 0;

  function say(text, side) {
    clearTimeout(messageHideTimer);
    side = side || "center";
    if (messageSide !== side) {
      messageSide = side;
      messageEl.setAttribute("data-side", side);
    }
    if (messageText !== text) {
      messageText = text;
      messageEl.textContent = text;
    }
    messageEl.classList.add("is-visible");
  }

  function hush(delay) {
    clearTimeout(messageHideTimer);
    messageHideTimer = setTimeout(function () {
      messageEl.classList.remove("is-visible");
    }, delay || 0);
  }

  /* ---------------- state machine ---------------- */
  var state = "idle"; // idle | left | right | greeting
  var timers = [];

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers.length = 0;
  }

  function returnToWork() {
    clearTimers();
    state = "idle";
    showFrame("working");
    hush(120);
    hero.removeAttribute("data-state");
  }

  function react(side) {
    // A new side reaction may interrupt the other side's hold, but never the greeting.
    if (state === "greeting") return;
    clearTimers();
    state = side;
    hero.setAttribute("data-state", side);
    showFrame(side === "left" ? "look-left" : "look-right");
    say(side === "left" ? "Anyone here on the left?" : "Anyone here on the right?", side);
    later(returnToWork, HOLD_SIDE_MS);
  }

  function greet() {
    if (state === "greeting") return;
    clearTimers();
    state = "greeting";
    hero.setAttribute("data-state", "greeting");

    var elapsed = 0;
    GREETING.forEach(function (step) {
      var frame = step[0],
        hold = step[1],
        text = step[2];
      later(function () {
        showFrame(frame);
        say(text, "center");
      }, elapsed);
      elapsed += hold;
    });
    later(returnToWork, elapsed);
  }

  /* ---------------- pointer zones (desktop) ---------------- */
  var lastZone = null; // zone the pointer is currently in
  var armedZone = null; // zone that may fire on next entry
  var pendingZone = null;
  var zoneRaf = 0;

  function zoneFromX(clientX) {
    var rect = hero.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width;
    if (x < 1 / 3) return "left";
    if (x > 2 / 3) return "right";
    return "center";
  }

  function commitZone() {
    zoneRaf = 0;
    var zone = pendingZone;
    if (zone === lastZone) return;
    lastZone = zone;
    if (zone === null) return;
    // Only fire on entry; a completed reaction won't loop while the pointer rests.
    if (zone === "center") greet();
    else react(zone);
  }

  function onPointerMove(e) {
    if (mobileQuery.matches) return;
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    pendingZone = zoneFromX(e.clientX);
    if (!zoneRaf) zoneRaf = requestAnimationFrame(commitZone);
  }

  function onPointerLeave() {
    pendingZone = null;
    if (!zoneRaf) zoneRaf = requestAnimationFrame(commitZone);
  }

  hero.addEventListener("pointermove", onPointerMove, { passive: true });
  hero.addEventListener("pointerleave", onPointerLeave, { passive: true });

  /* ---------------- mobile: centre-only experience ---------------- */
  function onTap() {
    if (!mobileQuery.matches) return;
    if (state === "greeting") return;
    greet();
  }
  stage.addEventListener("click", onTap);

  // Auto-greet once when the hero is in view on mobile.
  var autoGreeted = false;
  function maybeAutoGreet() {
    if (autoGreeted || !mobileQuery.matches) return;
    autoGreeted = true;
    later(greet, 900);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            maybeAutoGreet();
            io.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(stage);
  } else {
    maybeAutoGreet();
  }

  /* ---------------- nav backdrop on scroll ---------------- */
  var nav = document.querySelector(".nav");
  var navScrolled = false;
  var scrollRaf = 0;

  function updateNav() {
    scrollRaf = 0;
    var scrolled = window.scrollY > 32;
    if (scrolled !== navScrolled) {
      navScrolled = scrolled;
      nav.classList.toggle("is-scrolled", scrolled);
    }
  }

  if (nav) {
    window.addEventListener(
      "scroll",
      function () {
        if (!scrollRaf) scrollRaf = requestAnimationFrame(updateNav);
      },
      { passive: true }
    );
    updateNav();
  }

  // Pause timers when the tab is hidden so the sequence doesn't jump on return.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state !== "idle") returnToWork();
  });

  // Reset zone tracking if the layout mode flips (e.g. rotating a tablet).
  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", function () {
      lastZone = null;
      pendingZone = null;
      if (state !== "idle") returnToWork();
    });
  }
})();
