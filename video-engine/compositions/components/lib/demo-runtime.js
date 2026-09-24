/*
 * HFDemoRuntime -- minimal, faithful stand-in for the HyperFrames
 * sub-composition loader, used ONLY by this library's standalone demo.html
 * preview harnesses (never by the real project or by hyperframes itself).
 *
 * Real HyperFrames (inside Studio / render) fetches a sub-composition file,
 * parses it, clones its <template> contents into the host, and executes its
 * scripts, then seeks window.__timelines[id] on its own clock. A demo.html
 * needs the exact same mount behavior to preview one component in total
 * isolation in a plain browser tab -- no CLI, no project context -- so the
 * gallery (../gallery.html) can iframe every demo.html uniformly.
 *
 * IMPORTANT: browsers do not execute <script> elements inserted via
 * innerHTML/cloneNode. This runtime manually re-creates every <script>
 * found in the cloned template content, in document order, so they run.
 *
 * Usage (see any <name>/demo.html for the full pattern):
 *   HFDemoRuntime.mount({
 *     src: "./browser-window.html",     // relative to the demo.html page
 *     mountEl: document.getElementById("stage"),
 *     compositionId: "browser-window",
 *     variables: { url: "https://example.com", ... },
 *     width: 1080, height: 1920,
 *   }).then(function (handle) {
 *     // handle.timeline -> the registered paused GSAP timeline
 *     // handle.duration -> seconds
 *     HFDemoRuntime.attachScrubber(handle, document.getElementById("controls"));
 *   });
 */
(function (global) {
  "use strict";

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HFDemoRuntime: failed to fetch " + url + " (" + res.status + ")");
      return res.text();
    });
  }

  /** Stand in for data-variable-values: exposes __hyperframes.getVariables()
   *  exactly like the real runtime does, scoped globally since a demo.html
   *  only ever mounts one instance at a time. */
  function installVariables(vars) {
    global.__hyperframes = global.__hyperframes || {};
    global.__hyperframes.getVariables = function () {
      return vars || {};
    };
  }

  function runScriptsInOrder(scripts, index, done) {
    if (index >= scripts.length) {
      done();
      return;
    }
    var original = scripts[index];
    var el = document.createElement("script");
    for (var i = 0; i < original.attributes.length; i++) {
      var attr = original.attributes[i];
      el.setAttribute(attr.name, attr.value);
    }
    if (original.src) {
      el.onload = function () {
        runScriptsInOrder(scripts, index + 1, done);
      };
      el.onerror = function () {
        console.error("HFDemoRuntime: failed to load script", original.src);
        runScriptsInOrder(scripts, index + 1, done);
      };
      document.body.appendChild(el);
    } else {
      el.textContent = original.textContent;
      document.body.appendChild(el);
      runScriptsInOrder(scripts, index + 1, done);
    }
  }

  function waitForTimeline(compositionId, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var waited = 0;
      var step = 50;
      var timer = setInterval(function () {
        var tl = global.__timelines && global.__timelines[compositionId];
        if (tl) {
          clearInterval(timer);
          resolve(tl);
          return;
        }
        waited += step;
        if (waited >= timeoutMs) {
          clearInterval(timer);
          reject(new Error("HFDemoRuntime: timeline \"" + compositionId + "\" never registered within " + timeoutMs + "ms"));
        }
      }, step);
    });
  }

  function mount(opts) {
    installVariables(opts.variables);
    global.__timelines = global.__timelines || {};

    return fetchText(opts.src).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var template = doc.querySelector("template");
      if (!template) {
        throw new Error("HFDemoRuntime: no <template> found in " + opts.src);
      }
      var fragment = document.importNode(template.content, true);

      // Pull out every <script> so we can re-create + execute them in
      // order (innerHTML/appendChild alone would leave them inert).
      var scripts = Array.prototype.slice.call(fragment.querySelectorAll("script"));
      scripts.forEach(function (s) {
        s.parentNode.removeChild(s);
      });

      opts.mountEl.innerHTML = "";
      opts.mountEl.style.width = (opts.width || 1080) + "px";
      opts.mountEl.style.height = (opts.height || 1920) + "px";
      opts.mountEl.style.position = "relative";
      opts.mountEl.style.overflow = "hidden";
      opts.mountEl.appendChild(fragment);

      return new Promise(function (resolve, reject) {
        runScriptsInOrder(scripts, 0, function () {
          waitForTimeline(opts.compositionId, 4000).then(function (tl) {
            tl.pause();
            tl.seek(0, false);
            resolve({ timeline: tl, duration: tl.duration(), compositionId: opts.compositionId });
          }, reject);
        });
      });
    });
  }

  /** Wires a simple play/pause + scrub slider to a mounted handle. */
  function attachScrubber(handle, controlsEl) {
    var tl = handle.timeline;
    var duration = Math.max(0.01, handle.duration);
    controlsEl.innerHTML =
      '<button type="button" data-hf-play>Play</button>' +
      '<input type="range" data-hf-seek min="0" max="1000" value="0" style="width:260px;vertical-align:middle;margin:0 10px;">' +
      '<span data-hf-time style="font:12px/1 ui-monospace,monospace;color:#9aa1ad;">0.00s / ' +
      duration.toFixed(2) +
      "s</span>";

    var playBtn = controlsEl.querySelector("[data-hf-play]");
    var seek = controlsEl.querySelector("[data-hf-seek]");
    var timeLabel = controlsEl.querySelector("[data-hf-time]");
    var playing = false;
    var rafId = null;

    function render() {
      var t = tl.time();
      seek.value = String(Math.round((t / duration) * 1000));
      timeLabel.textContent = t.toFixed(2) + "s / " + duration.toFixed(2) + "s";
    }

    function tick(prevTs) {
      return function (ts) {
        if (!playing) return;
        var dt = prevTs == null ? 0 : (ts - prevTs) / 1000;
        var next = tl.time() + dt;
        if (next >= duration) {
          next = 0;
        }
        // IMPORTANT: GSAP's tl.seek(t) defaults suppressEvents to true,
        // which silently skips onUpdate/onStart/onComplete callbacks --
        // exactly the mechanism this library's typing-text and proxy-driven
        // effects rely on (see browser-window.html's URL-typing tween).
        // The real HyperFrames renderer does NOT suppress these (confirmed:
        // a real `hyperframes snapshot`/render shows typing progressing
        // correctly), so this demo scrubber must not either -- pass
        // suppressEvents=false explicitly rather than relying on a default.
        tl.seek(next, false);
        render();
        rafId = requestAnimationFrame(tick(ts));
      };
    }

    playBtn.addEventListener("click", function () {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Play";
      if (playing) {
        rafId = requestAnimationFrame(tick(null));
      } else if (rafId) {
        cancelAnimationFrame(rafId);
      }
    });

    seek.addEventListener("input", function () {
      playing = false;
      playBtn.textContent = "Play";
      if (rafId) cancelAnimationFrame(rafId);
      var t = (parseFloat(seek.value) / 1000) * duration;
      tl.seek(t, false);
      render();
    });

    render();
  }

  global.HFDemoRuntime = { mount: mount, attachScrubber: attachScrubber };
})(window);
