/* EXPL-FR project page. No dependencies; one data fetch for the explorer. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var DEV = new URLSearchParams(location.search).has("dev");
  var DATA = "static/data/signatures." + (DEV ? "dev.json" : "json");
  var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(t, a, p) {
    var n = document.createElementNS(NS, t);
    for (var k in a) if (a[k] != null) n.setAttribute(k, a[k]);
    if (p) p.appendChild(n);
    return n;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function fmt(v, dp) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(dp == null ? 3 : dp); }
  function ease(v) { return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; }
  function lcg(s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function rgbaVar(name, a) {
    var h = css(name);
    if (h.charAt(0) !== "#" || h.length < 7) return h;
    var r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16),
        b = parseInt(h.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /* --------------------------------------------------- alignment ---------- */
  /* Two encoders in unrelated coordinate systems, then the adapter maps one
     onto the other. Cross-encoder verification runs 50.29 -> 94.56 with it.   */

  function alignment() {
    var cv = document.getElementById("align-canvas");
    if (!cv) return;
    var x = cv.getContext("2d"), W = 0, H = 0, DPR = 1;
    var N = 190, pts = [], R = lcg(2029);

    for (var i = 0; i < N; i++) {
      var a = R() * 6.283, r = Math.sqrt(R());
      // where the face embedding sits, and where its prompt anchor ends up
      var fx = Math.cos(a) * r, fy = Math.sin(a) * r * .72;
      pts.push({
        fx: fx, fy: fy,
        // unaligned: the anchor is somewhere unrelated in its own frame
        ux: (R() - .5) * 2, uy: (R() - .5) * 1.5,
        // aligned: it lands beside the face it describes
        ax: fx + (R() - .5) * .16, ay: fy + (R() - .5) * .16,
        w: .35 + R() * .85, ph: R() * 6.283
      });
    }

    var t0 = null, prog = 0, drift = 0, DUR = 4800, HOLD = 4800, raf = 0;
    var pct = document.getElementById("align-pct"),
        stage = document.getElementById("align-stage"),
        fill = document.getElementById("align-fill");
    var LO = 50.29, HI = 94.56, CEIL = 97.44;

    function size() {
      DPR = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      x.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function paint(p) {
      x.clearRect(0, 0, W, H);
      var cx = W * .5, cy = H * .58, s = Math.min(W * .20, H * .33);
      var sep = (1 - p) * Math.min(W * .21, 190);   // the gap between the two frames
      drift += .0018;

      for (var i = 0; i < pts.length; i++) {
        var q = pts[i];
        var bob = Math.sin(drift + q.ph) * .012;

        // face embeddings, one fixed frame
        var fX = cx + sep + q.fx * s, fY = cy + (q.fy + bob) * s;
        x.beginPath(); x.arc(fX, fY, q.w * 1.9, 0, 6.283);
        x.fillStyle = rgbaVar("--pos", .72); x.fill();

        // prompt anchors in their own frame, rotated until the adapter lands them
        var rot = (1 - p) * 0.9;
        var ux = q.ux + (q.ax - q.ux) * p, uy = q.uy + (q.ay - q.uy) * p;
        var rx = ux * Math.cos(rot) - uy * Math.sin(rot);
        var ry = ux * Math.sin(rot) + uy * Math.cos(rot);
        var aX = cx - sep + rx * s, aY = cy + (ry + bob) * s;
        x.beginPath(); x.arc(aX, aY, q.w * 1.9, 0, 6.283);
        x.fillStyle = rgbaVar("--neg", .72); x.fill();

        // once aligned, tie each anchor to the face it describes
        if (p > .82) {
          x.globalAlpha = (p - .82) / .18 * .3;
          x.beginPath(); x.moveTo(aX, aY); x.lineTo(fX, fY);
          x.strokeStyle = css("--ink-3"); x.lineWidth = .5; x.stroke();
          x.globalAlpha = 1;
        }
      }
    }

    function hud(p) {
      var v = LO + (HI - LO) * p;
      /* Snap displayed % so the HUD does not tick every frame. */
      var disp = p < .03 ? LO : p > .97 ? HI : Math.round(v);
      var txt = (p < .03 || p > .97 ? disp.toFixed(2) : String(disp)) + "%";
      if (pct.textContent !== txt) pct.textContent = txt;
      stage.textContent = p < .04 ? "unaligned, at chance"
        : p > .96 ? "aligned, 2.88 under the FR ceiling" : "aligning";
      fill.style.width = ((v - LO) / (CEIL - LO) * 100) + "%";
    }

    function frame(now) {
      if (t0 === null) t0 = now;
      var el = now - t0;
      if (el < DUR) prog = ease(Math.max(0, Math.min(1, el / DUR)));
      else if (el < DUR + HOLD) prog = 1;
      else { t0 = now; prog = 0; }
      paint(prog); hud(prog);
      raf = requestAnimationFrame(frame);
    }

    function run() { cancelAnimationFrame(raf); t0 = null; raf = requestAnimationFrame(frame); }

    addEventListener("resize", function () { size(); paint(prog); });
    document.addEventListener("explfr-theme", function () { paint(prog); });
    size();

    if (REDUCED) { paint(1); hud(1); }
    else {
      var started = false;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !started) { started = true; run(); }
        });
      }, { threshold: .25 }).observe(cv);
      paint(0); hud(0);
    }
    var rb = document.getElementById("align-replay");
    if (rb) rb.onclick = function () { if (REDUCED) { paint(1); hud(1); } else run(); };
  }

  /* ------------------------------------------------- reading a face ------- */

  /* Illustrative values on the synthetic faces shipped with the page. They
     show the shape of the three cases; replace them with a real export when
     static/data/signatures.json lands.                                      */
  var CASES = [
    { role: "genuine", verdict: "match", tone: "var(--pos)", score: 0.71, rows: [
      ["cam. angle · a frontal view", 0.026], ["skin feat. · smooth skin", -0.022],
      ["facial feat. · thick eyebrows", 0.018], ["eyewear · no eyewear", -0.010],
      ["hairstyle · short hair", 0.004]] },
    { role: "imposter", verdict: "non-match", tone: "var(--neg)", score: 0.09, rows: [
      ["facial hair · a goatee", -0.168], ["hairstyle · a receding hairline", -0.151],
      ["skin feat. · tanned skin", -0.139], ["hair colour · brown hair", 0.121],
      ["facial feat. · a broad nose", -0.097]] },
    { role: "morph", verdict: "morph", tone: "var(--ink-2)", score: 0.42, rows: [
      ["facial hair · a goatee", -0.114], ["hairstyle · a receding hairline", -0.086],
      ["skin feat. · tanned skin", -0.079], ["facial feat. · a broad nose", -0.061],
      ["hair colour · brown hair", 0.048]] }
  ];

  function reading() {
    var img = document.getElementById("face-cmp"), role = document.getElementById("face-role"),
        diffRole = document.getElementById("diff-role"),
        sEl = document.getElementById("ver-score"), vEl = document.getElementById("ver-label"),
        list = document.getElementById("reasons"), nav = document.getElementById("read-nav"),
        blend = document.getElementById("blend"),
        out = document.getElementById("blend-out");
    if (!list || !nav) return;
    var idx = -1, timer;

    function label(r) {
      return r.charAt(0).toUpperCase() + r.slice(1);
    }

    CASES.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label(c.role);
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.setAttribute("aria-label", "Compare to " + c.role);
      b.onclick = function () { clearTimeout(timer); show(i); queue(); };
      nav.appendChild(b);
    });

    function show(i) {
      idx = i;
      var c = CASES[i];
      img.src = "static/faces/" + c.role + ".jpg";
      if (blend) blend.value = 100;
      img.alt = c.role + " face";
      var lbl = label(c.role);
      role.textContent = lbl;
      if (diffRole) diffRole.textContent = c.role;
      [].forEach.call(nav.children, function (b, j) {
        b.setAttribute("aria-selected", String(j === i));
      });

      vEl.textContent = c.verdict; vEl.style.color = c.tone;

      var max = Math.max.apply(null, c.rows.map(function (r) { return Math.abs(r[1]); }));
      list.innerHTML = "";
      c.rows.forEach(function (r, j) {
        var li = document.createElement("li");
        li.dataset.full = (Math.abs(r[1]) / Math.max(max, 1e-6) * 50).toFixed(3);
        li.dataset.v = r[1];
        li.innerHTML =
          '<span class="t">' + esc(r[0]) + '</span>' +
          '<span class="b"><u></u><i style="' +
            (r[1] >= 0 ? "left:50%;background:var(--pos)" : "right:50%;background:var(--neg)") +
          '"></i></span>' +
          '<span class="n"></span>';
        list.appendChild(li);
        setTimeout(function () { li.classList.add("in"); applyBlend(); },
          REDUCED ? 0 : 70 + j * 80);
      });
      applyBlend();
    }

    /* The slider blends the reference toward the compared face: the image
       cross-fades and the differential grows from nothing to its full value. */
    function applyBlend() {
      var c = CASES[idx < 0 ? 0 : idx], t = blend ? +blend.value / 100 : 1;
      if (out) out.textContent = Math.round(t * 100) + "%";
      if (img) img.style.opacity = String(t);
      sEl.textContent = (1 - (1 - c.score) * t).toFixed(2);
      [].forEach.call(list.children, function (li) {
        var v = (+li.dataset.v) * t;
        li.querySelector("i").style.width = (+li.dataset.full * t) + "%";
        li.querySelector(".n").textContent =
          (v < 0 ? "−" : "+") + Math.abs(v).toFixed(3);
      });
      vEl.style.opacity = String(t < .5 ? .35 : 1);
    }
    function queue() { if (!REDUCED) timer = setTimeout(next, 5600); }
    function next() { show((idx + 1) % CASES.length); queue(); }
    if (blend) blend.addEventListener("input", function () {
      clearTimeout(timer); applyBlend();
    });
    show(0); queue();
  }


  /* ----------------------------------------------- write an attribute ----- */
  /* A lookup over the published vocabulary, not live inference: the page has
     no model. We match what you type to the nearest released prompt.         */

  function attributeBox(data, lay, rows) {
    var box = document.getElementById("ask-in"), out = document.getElementById("ask-out");
    if (!box || !out) return;

    var norm = function (t) { return t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ").trim(); };
    var STOP = { a:1, an:1, the:1, of:1, with:1, photo:1, person:1, "in":1, is:1, and:1, wearing:0 };
    var toks = function (t) {
      return norm(t).split(" ").filter(function (w) { return w && !STOP[w]; });
    };
    var index = data.prompts.map(function (p, i) { return { i: i, t: toks(p.t) }; });

    function best(q) {
      var qt = toks(q);
      if (!qt.length) return null;
      var top = null;
      index.forEach(function (e) {
        var hit = 0;
        qt.forEach(function (w) {
          if (e.t.indexOf(w) >= 0) hit += 1;
          else if (e.t.some(function (x) { return x.indexOf(w) === 0 || w.indexOf(x) === 0; })) hit += .6;
        });
        var sc = hit / Math.max(qt.length, 1) - Math.abs(e.t.length - qt.length) * 0.02;
        if (!top || sc > top.sc) top = { sc: sc, i: e.i };
      });
      return top && top.sc >= 0.5 ? top : null;
    }

    box.addEventListener("input", function () {
      var q = box.value.trim();
      if (!q) { out.innerHTML = ""; return; }
      var m = best(q);
      if (!m) {
        out.innerHTML = '<span class="miss">no prompt in the released vocabulary matches that ' +
          'closely. Try a concrete attribute: hair colour, eyewear, facial hair.</span>';
        return;
      }
      var p = data.prompts[m.i];
      var row = rows[0];
      var vals = row.v, mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      var v = vals[m.i] - mean;
      var mx = Math.max.apply(null, vals.map(function (x) { return Math.abs(x - mean); }));
      var w = Math.abs(v) / Math.max(mx, 1e-6) * 100;
      out.innerHTML =
        'nearest released prompt &rarr; <b>' + esc(p.t) + '</b><br>' +
        esc(p.c) + ' &middot; <span class="val">' + fmt(v) + '</span> on ' +
        esc(rowLabel(row)) +
        '<span class="ask-bar"><i style="width:' + w.toFixed(1) + '%;background:' +
        (v >= 0 ? "var(--pos)" : "var(--neg)") + '"></i></span>';
    });
  }

  /* ------------------------------------------------------- explorer ------- */

  function layout(prompts) {
    var order = prompts.map(function (_, i) { return i; });
    order.sort(function (a, b) {
      var ca = prompts[a].c, cb = prompts[b].c;
      return ca < cb ? -1 : ca > cb ? 1 : a - b;
    });
    var groups = [], cur = null;
    order.forEach(function (idx, pos) {
      var c = prompts[idx].c;
      if (!cur || cur.cat !== c) { cur = { cat: c, from: pos, to: pos + 1 }; groups.push(cur); }
      else cur.to = pos + 1;
    });
    return { order: order, groups: groups };
  }

  function barPath(x, w, y0, y1) {
    var up = y1 < y0, h = Math.abs(y1 - y0), r = Math.min(2.5, w / 2, h);
    if (h < .35) return "M" + x + "," + y0 + "h" + w + "v.35h" + (-w) + "Z";
    return up
      ? "M" + x + "," + y0 + "V" + (y1 + r) + "a" + r + "," + r + " 0 0 1 " + r + "," + (-r) +
        "h" + (w - 2 * r) + "a" + r + "," + r + " 0 0 1 " + r + "," + r + "V" + y0 + "Z"
      : "M" + x + "," + y0 + "V" + (y1 - r) + "a" + r + "," + r + " 0 0 0 " + r + "," + r +
        "h" + (w - 2 * r) + "a" + r + "," + r + " 0 0 0 " + r + "," + (-r) + "V" + y0 + "Z";
  }

  function niceTick(m) {
    if (!(m > 0)) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(m))), k = m / e;
    return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 5 ? 5 : 10) * e;
  }

  function draw(host, values, lay, label) {
    var W = 1000, H = 300, mL = 46, mR = 4, mT = 12, mB = 62;
    var pw = W - mL - mR, ph = H - mT - mB, y0 = mT + ph / 2;
    var order = lay.order, n = order.length, maxAbs = 0;
    for (var i = 0; i < values.length; i++) maxAbs = Math.max(maxAbs, Math.abs(values[i]));
    var tick = niceTick(maxAbs), dom = Math.max(maxAbs * 1.06, tick * 1.02);
    var slot = pw / n, bw = Math.max(1.5, slot - 2);

    host.textContent = "";
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet",
      role: "img", "aria-label": label
    }, host);

    lay.groups.forEach(function (g, gi) {
      if (gi % 2) el("rect", {
        x: mL + g.from * slot, y: mT, width: (g.to - g.from) * slot, height: ph,
        fill: "var(--field)"
      }, svg);
    });
    [-tick, 0, tick].forEach(function (t) {
      var y = y0 - (t / dom) * (ph / 2);
      el("line", { x1: mL, x2: mL + pw, y1: y, y2: y,
        stroke: t === 0 ? "var(--rule-2)" : "var(--rule)", "stroke-width": 1 }, svg);
      var tx = el("text", { x: mL - 9, y: y + 4, "text-anchor": "end", fill: "var(--ink-3)",
        "font-size": 11, "font-family": "var(--mono)" }, svg);
      tx.textContent = t === 0 ? "0" : fmt(t, 2);
    });

    var bars = el("g", null, svg);
    order.forEach(function (idx, k) {
      var v = values[idx], y1 = y0 - (v / dom) * (ph / 2), x = mL + k * slot + 1;
      el("path", { d: barPath(x, bw, y0, y1), fill: v >= 0 ? "var(--pos)" : "var(--neg)" }, bars);
    });

    lay.groups.forEach(function (g) {
      var cx = mL + ((g.from + g.to) / 2) * slot, y = mT + ph + 14;
      var t = el("text", { x: cx, y: y, "text-anchor": "end", fill: "var(--ink-3)",
        "font-size": 11, "font-family": "var(--mono)",
        transform: "rotate(-38 " + cx + " " + y + ")" }, svg);
      t.textContent = g.cat;
    });

    var hover = el("rect", { x: 0, y: mT, width: slot, height: ph,
      fill: "var(--ink)", opacity: 0, "pointer-events": "none" }, svg);
    var hit = el("g", null, svg);
    order.forEach(function (idx, k) {
      el("rect", { x: mL + k * slot, y: mT, width: slot, height: ph,
        fill: "transparent", "data-i": idx, "data-k": k }, hit);
    });

    return { svg: svg, hit: hit, hover: hover, slot: slot, mL: mL, y0: y0, order: order, H: H };
  }

  function rowLabel(r) {
    return r.level === "identity"
      ? "Identity " + r.group + (r.n ? " (mean of " + r.n + ")" : "")
      : r.group + " · " + r.item;
  }
  function centred(v) {
    var m = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
    return v.map(function (x) { return x - m; });
  }

  function explorer(data) {
    var lay = layout(data.prompts), rows = data.rows;
    var title = document.getElementById("exp-title"),
        lead = document.getElementById("exp-lead");
    if (title) title.textContent = "Signature Explorer";
    if (lead) lead.textContent = "Pick a row, compare two for the signed difference, or look up " +
      "an attribute in the released vocabulary.";
    var selA = document.getElementById("rowA"), selB = document.getElementById("rowB"),
        grpB = document.getElementById("grpB"), plot = document.getElementById("plot"),
        tip = document.getElementById("tip"), cap = document.getElementById("cap"),
        tbl = document.getElementById("tbl"), key = document.getElementById("legend"),
        mOne = document.getElementById("mOne"), mDiff = document.getElementById("mDiff"),
        vChart = document.getElementById("vChart"), vTable = document.getElementById("vTable"),
        exp = document.getElementById("exp");

    rows.forEach(function (r, i) {
      [selA, selB].forEach(function (s) {
        var o = document.createElement("option");
        o.value = i; o.textContent = rowLabel(r); s.appendChild(o);
      });
    });

    var st = { diff: false, table: false, a: 0, b: Math.min(1, rows.length - 1) };
    function clampRow(v, d) { var i = parseInt(v, 10); return (isFinite(i) && i >= 0 && i < rows.length) ? i : d; }
    (function () {
      var q = new URLSearchParams(location.search);
      st.a = clampRow(q.get("sig"), st.a);
      st.b = clampRow(q.get("minus"), st.b);
      if (q.get("mode") === "diff") st.diff = true;
      if (q.get("view") === "table") st.table = true;
    })();
    function writeURL() {
      var q = new URLSearchParams(location.search);
      q.set("sig", st.a);
      if (st.diff) { q.set("mode", "diff"); q.set("minus", st.b); } else { q.delete("mode"); q.delete("minus"); }
      if (st.table) q.set("view", "table"); else q.delete("view");
      history.replaceState(null, "", location.pathname + "?" + q + location.hash);
    }

    var byCase = {};
    rows.forEach(function (r, i) {
      if (r.level !== "identity") (byCase[r.group] = byCase[r.group] || {})[r.item] = i;
    });
    var chips = document.getElementById("presets"), c1 = Object.keys(byCase)[0];
    if (c1 && byCase[c1].reference != null) {
      ["genuine", "imposter", "morph"].forEach(function (role) {
        var j = byCase[c1][role];
        if (j == null) return;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = "reference − " + role;
        b.onclick = function () { st.diff = true; st.a = byCase[c1].reference; st.b = j; sync(); render(); };
        chips.appendChild(b);
      });
    }

    function current() {
      var a = rows[st.a];
      if (!st.diff) return { v: centred(a.v), title: rowLabel(a), diff: false };
      var b = rows[st.b];
      return { v: a.v.map(function (x, i) { return x - b.v[i]; }),
               title: rowLabel(a) + " − " + rowLabel(b), diff: true };
    }
    function sync() {
      selA.value = st.a; selB.value = st.b; grpB.hidden = !st.diff;
      mOne.setAttribute("aria-pressed", String(!st.diff));
      mDiff.setAttribute("aria-pressed", String(st.diff));
      vChart.setAttribute("aria-pressed", String(!st.table));
      vTable.setAttribute("aria-pressed", String(st.table));
      plot.hidden = st.table; tbl.hidden = !st.table;
      writeURL();
    }
    function table(cur) {
      var idx = data.prompts.map(function (_, i) { return i; });
      idx.sort(function (i, j) { return Math.abs(cur.v[j]) - Math.abs(cur.v[i]); });
      var h = "<table><thead><tr><th>#</th><th>Prompt</th><th>Category</th>" +
              "<th class='num'>Value</th></tr></thead><tbody>";
      idx.forEach(function (i, k) {
        h += "<tr><td class='muted'>" + (k + 1) + "</td><td>" + esc(data.prompts[i].t) +
             "</td><td class='muted'>" + esc(data.prompts[i].c) +
             "</td><td class='num'>" + fmt(cur.v[i]) + "</td></tr>";
      });
      tbl.innerHTML = h + "</tbody></table>";
    }

    function render() {
      var cur = current();
      cap.textContent = cur.title + " · " + data.n_prompts + " prompts · target " + data.target;
      key.hidden = st.table;
      key.children[0].lastChild.textContent = cur.diff
        ? " stronger in the first signature" : " above the row's own mean";
      key.children[1].lastChild.textContent = cur.diff ? " stronger in the second" : " below it";
      if (st.table) { table(cur); return; }

      var c = draw(plot, cur.v, lay, "Semantic signature: " + cur.title);
      plot.appendChild(tip);

      function show(i, k) {
        c.hover.setAttribute("x", c.mL + k * c.slot);
        c.hover.setAttribute("opacity", .06);
        var p = data.prompts[i];
        tip.innerHTML = "<b>" + esc(p.t) + "</b>" + esc(p.c) + " &middot; " + fmt(cur.v[i]);
        var box = plot.getBoundingClientRect(), sb = c.svg.getBoundingClientRect();
        tip.style.left = (sb.left - box.left + (c.mL + (k + .5) * c.slot) * (sb.width / 1000)) + "px";
        tip.style.top = (sb.top - box.top + (c.y0 - 10) * (sb.height / c.H)) + "px";
        tip.style.opacity = 1;
      }
      function hide() { tip.style.opacity = 0; c.hover.setAttribute("opacity", 0); }

      c.hit.addEventListener("mousemove", function (e) {
        var t = e.target;
        if (t.dataset && t.dataset.i != null) show(+t.dataset.i, +t.dataset.k);
      });
      c.hit.addEventListener("mouseleave", hide);

      var ks = 0;
      c.svg.setAttribute("tabindex", "0");
      c.svg.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        ks = Math.max(0, Math.min(c.order.length - 1, ks + (e.key === "ArrowRight" ? 1 : -1)));
        show(c.order[ks], ks);
      });
      c.svg.addEventListener("blur", hide);
    }

    selA.onchange = function () { st.a = +selA.value; sync(); render(); };
    selB.onchange = function () { st.b = +selB.value; sync(); render(); };
    mOne.onclick   = function () { st.diff = false; sync(); render(); };
    mDiff.onclick  = function () { st.diff = true;  sync(); render(); };
    vChart.onclick = function () { st.table = false; sync(); render(); };
    vTable.onclick = function () { st.table = true;  sync(); render(); };
    sync(); render();
    attributeBox(data, lay, rows);
    addEventListener("resize", function () { if (!st.table) render(); });
  }

  /* Without static/data/signatures.json there is nothing to explore, so the
     controls come out and the paper's figure goes in, saying as much.       */
  function noData() {
    var exp = document.getElementById("exp");
    if (!exp) return;
    var mono = 'font-family:var(--mono);font-size:11.5px;color:var(--ink-3)';
    exp.innerHTML =
      '<div style="padding:.85rem">' +
      '<p style="' + mono + ';margin:0 0 .7rem">' +
      'Explanations at three granularities, from the paper.</p>' +
      '<figure style="margin:0"><img loading="lazy" src="static/images/explanations.png" ' +
      'alt="Identity-wise, per-image and differential explanations."></figure>' +
      '<p style="' + mono + ';margin:.6rem 0 0">' +
      'Identity-wise (rows 1-2), per-image (rows 3-5) and differential ' +
      '(rows 6-8) explanations.</p></div>';
  }



  /* ------------------------------------------------- pipeline stepper ----- */
  /* Regions are in the figure's own 994x629 coordinate space.                */

  var STAGES = [
    { k: "1 · align", x: 255, y: 398, w: 735, h: 230,
      say: "<b>Trained on images alone.</b> The adapter is fitted by cosine alignment between " +
           "frozen VLM image embeddings and frozen FR embeddings. It never sees a word of text, " +
           "no attribute labels, no white-box access. This is the only training that happens." },
    { k: "2 · transfer", x: 2, y: 48, w: 828, h: 158,
      say: "<b>Prompts become anchors.</b> Because the VLM's image and text encoders share one " +
           "space, the same frozen adapter applies to the text side. Every sentence you write " +
           "lands as a direction in the FR model's own coordinates." },
    { k: "3 · read", x: 288, y: 193, w: 592, h: 218,
      say: "<b>Signatures.</b> A face goes through the frozen FR model; its cosine similarity to " +
           "each anchor is one bar of the semantic signature, the explanation read off the " +
           "deployed matcher rather than a commentator on it." }
  ];

  function pipeline() {
    var host = document.getElementById("pipe"),
        steps = document.getElementById("pipe-steps"),
        say = document.getElementById("pipe-say");
    if (!host || !steps) return;

    var svg = el("svg", { viewBox: "0 0 994 629", preserveAspectRatio: "none" }, host);
    var defs = el("defs", null, svg);
    var mask = el("mask", { id: "pipe-mask" }, defs);
    el("rect", { x: 0, y: 0, width: 994, height: 629, fill: "#fff" }, mask);
    var hole = el("rect", { class: "hole", fill: "#000", rx: 3 }, mask);
    var dim = el("rect", { x: 0, y: 0, width: 994, height: 629, fill: "var(--paper)",
      opacity: 0, mask: "url(#pipe-mask)" }, svg);
    var ring = el("rect", { class: "ring", fill: "none", stroke: "var(--pos)",
      "stroke-width": 2, rx: 3, opacity: 0 }, svg);

    var cur = -1;
    function show(i) {
      cur = i;
      var st = STAGES[i];
      [hole, ring].forEach(function (r) {
        r.setAttribute("x", st.x); r.setAttribute("y", st.y);
        r.setAttribute("width", st.w); r.setAttribute("height", st.h);
      });
      dim.setAttribute("opacity", .78);
      ring.setAttribute("opacity", 1);
      say.innerHTML = st.say;
      [].forEach.call(steps.children, function (b, j) {
        b.setAttribute("aria-pressed", String(j === i));
      });
    }
    function clear() {
      cur = -1;
      dim.setAttribute("opacity", 0); ring.setAttribute("opacity", 0);
      say.innerHTML = "<b>The whole pipeline.</b> Step through it to see which part does what.";
      [].forEach.call(steps.children, function (b) { b.setAttribute("aria-pressed", "false"); });
    }

    STAGES.forEach(function (st, i) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = st.k;
      b.onclick = function () { i === cur ? clear() : show(i); };
      steps.appendChild(b);
    });
    var all = document.createElement("button");
    all.type = "button"; all.textContent = "whole figure";
    all.onclick = clear; steps.appendChild(all);

    clear();
    if (!REDUCED && "IntersectionObserver" in window) {
      var fired = false;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting || fired) return;
          fired = true;
          show(0);
          setTimeout(function () { if (cur === 0) show(1); }, 2600);
          setTimeout(function () { if (cur === 1) show(2); }, 5200);
        });
      }, { threshold: .45 }).observe(host);
    }
  }

  /* --------------------------------------------- detectability chart ------ */
  /* Two measures on one scale per concept: a dumbbell, never a dual axis.
     Open mark = VLM space, filled = adapter-mapped FR space.                  */

  function detectChart(data) {
    var mount = document.getElementById("detect-mount");
    if (!mount) return;
    var C = data.concepts;
    if (!C || !C.length) return;

    var VLM = css("--neg"), FR = css("--pos");
    var W = 760, row = 25, mT = 26, mB = 40, mL = 132, mR = 62;
    var H = mT + C.length * row + mB;

    var lo = Math.min.apply(null, C.map(function (d) { return Math.min(d.vlm, d.fr); }));
    var hi = Math.max.apply(null, C.map(function (d) { return Math.max(d.vlm, d.fr); }));
    lo = Math.floor((lo - .02) * 20) / 20; hi = Math.min(1, Math.ceil((hi + .01) * 20) / 20);
    var pw = W - mL - mR;
    var X = function (v) { return mL + (v - lo) / (hi - lo) * pw; };

    mount.textContent = "";
    mount.style.position = "relative";
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Label-free detectability per concept, VLM space versus FR space" }, mount);
    svg.style.width = "100%"; svg.style.height = "auto"; svg.style.display = "block";

    // x grid
    var ticks = [], step = (hi - lo) > .25 ? .1 : .05;
    for (var v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
    ticks.forEach(function (t) {
      el("line", { x1: X(t), x2: X(t), y1: mT - 8, y2: mT + C.length * row - 6,
        stroke: "var(--rule)", "stroke-width": 1 }, svg);
      var lb = el("text", { x: X(t), y: mT + C.length * row + 12, "text-anchor": "middle",
        fill: "var(--ink-3)", "font-size": 10.5, "font-family": "var(--mono)" }, svg);
      lb.textContent = t.toFixed(2);
    });
    var ax = el("text", { x: mL + pw / 2, y: H - 8, "text-anchor": "middle",
      fill: "var(--ink-3)", "font-size": 10.5, "font-family": "var(--mono)" }, svg);
    ax.textContent = "mean detectability AUC per concept";

    var tip = document.createElement("div");
    tip.className = "tip"; mount.appendChild(tip);

    C.forEach(function (d, i) {
      var y = mT + i * row + row / 2;
      var g = el("g", { class: "dumbbell" }, svg);

      el("line", { x1: X(Math.min(d.vlm, d.fr)), x2: X(Math.max(d.vlm, d.fr)),
        y1: y, y2: y, stroke: "var(--rule-2)", "stroke-width": 1.5 }, g);
      // surface ring keeps the marks legible where they overlap
      el("circle", { cx: X(d.vlm), cy: y, r: 4.5, fill: "none",
        stroke: VLM, "stroke-width": 1.6 }, g);
      el("circle", { cx: X(d.fr), cy: y, r: 4.5, fill: FR,
        stroke: "var(--paper)", "stroke-width": 2 }, g);

      var lab = el("text", { x: mL - 12, y: y + 3.5, "text-anchor": "end",
        fill: "var(--ink-2)", "font-size": 11.5, "font-family": "var(--mono)" }, svg);
      lab.textContent = d.c;
      // direct label so the value never depends on hover
      var val = el("text", { x: W - mR + 10, y: y + 3.5, fill: "var(--ink-3)",
        "font-size": 11, "font-family": "var(--mono)" }, svg);
      val.textContent = d.fr.toFixed(3);

      var hit = el("rect", { x: 0, y: mT + i * row, width: W, height: row,
        fill: "transparent" }, svg);
      hit.style.cursor = "crosshair";
      hit.addEventListener("mouseenter", function () {
        tip.innerHTML = "<b>" + esc(d.c) + "</b>VLM " + d.vlm.toFixed(3) +
          " &middot; FR " + d.fr.toFixed(3) + " &middot; " + d.n + " prompts";
        var r = svg.getBoundingClientRect(), m = mount.getBoundingClientRect();
        var sc = r.width / W;
        tip.style.left = (r.left - m.left + X(d.fr) * sc) + "px";
        tip.style.top = (r.top - m.top + (y - 8) * (r.height / H)) + "px";
        tip.style.opacity = 1;
      });
      hit.addEventListener("mouseleave", function () { tip.style.opacity = 0; });
    });

    var key = document.createElement("p");
    key.className = "detect-key";
    key.innerHTML =
      '<span><i class="ring" style="border-color:' + VLM + '"></i> VLM space</span>' +
      '<span><i style="background:' + FR + '"></i> adapter-mapped FR space</span>';
    mount.appendChild(key);

    var note = document.getElementById("detect-note");
    if (note) note.textContent = "Measured on " + data.n_images.toLocaleString() +
      " unlabeled images, " + data.n_prompts + " prompts, target " + data.target + ".";
  }

  /* --------------------------------------------- audit figure switcher ---- */

  var AUDIT = [
    { src: "static/images/selection_rfw.png", w: 2230, h: 613,
      cap: "<b>Figure 4.</b> Model selection. Each point is one (FR model, ethnicity group) pair: " +
           "label-free dependence against real verification error " +
           "(<span style=\"font-family:var(--mono)\">&tau; = 0.92</span>)." },
    { src: "static/images/diagnosis_gancontrol.png", w: 1660, h: 567,
      cap: "<b>Figure 5.</b> Model diagnosis. Each point is one varied attribute: " +
           "matched-axis sensitivity against the real EER of the protocol varying that attribute " +
           "(<span style=\"font-family:var(--mono)\">&rho; = 0.90 / 0.83 / 0.95</span>)." }
  ];

  function auditGallery() {
    var img = document.getElementById("audit-img"),
        cap = document.getElementById("audit-caption"),
        tabs = document.getElementById("audit-tabs");
    if (!img || !tabs) return;

    function show(i) {
      var a = AUDIT[i];
      img.src = a.src;
      img.width = a.w; img.height = a.h;
      img.alt = a.cap.replace(/<[^>]+>/g, "");
      if (cap) cap.innerHTML = a.cap;
      [].forEach.call(tabs.children, function (b, j) {
        b.setAttribute("aria-selected", String(j === i));
      });
    }
    [].forEach.call(tabs.children, function (b, i) {
      b.onclick = function () { show(i); };
    });
  }

  /* --------------------------------------------------------- chrome ------- */

  function chrome() {
    var b = document.getElementById("theme"), saved = null;
    try { saved = localStorage.getItem("explfr-theme"); } catch (e) {}
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    if (b) b.onclick = function () {
      var cur = document.documentElement.getAttribute("data-theme");
      if (!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("explfr-theme", next); } catch (e) {}
      document.dispatchEvent(new Event("explfr-theme"));
    };

    document.querySelectorAll(".copy").forEach(function (btn) {
      btn.onclick = function () {
        navigator.clipboard.writeText(btn.parentNode.querySelector("pre").innerText)
          .then(function () {
            var was = btn.textContent;
            btn.textContent = "Copied";
            setTimeout(function () { btn.textContent = was; }, 1300);
          });
      };
    });

    var lb = document.getElementById("lb");
    if (lb) {
      var im = lb.querySelector("img");
      document.querySelectorAll(".panel img, .pipe img, .audit-viewport img").forEach(function (t) {
        if (t.closest(".faces")) return;
        t.onclick = function () {
          im.src = t.currentSrc || t.src;
          im.alt = t.alt; lb.showModal();
        };
      });
      lb.querySelector(".x").onclick = function () { lb.close(); };
      lb.onclick = function (e) { if (e.target === lb) lb.close(); };
    }

  }

  chrome();
  alignment();
  pipeline();
  reading();
  auditGallery();
  fetch(DATA, { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(explorer)
    .catch(function (e) { console.warn("[explfr] no signature export (" + e.message + ")"); noData(); });

  fetch("static/data/detectability." + (DEV ? "dev.json" : "json"), { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(detectChart)
    .catch(function (e) {
      console.warn("[explfr] no detectability export (" + e.message + "); keeping the figure");
    });
})();
